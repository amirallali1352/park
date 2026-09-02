import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export function backupFileName(date = new Date()) {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
  return `stp-os-${iso.slice(0, 8)}-${iso.slice(9, 15)}Z.sql`;
}

export function verificationDatabaseName(date = new Date()) {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
  return `stp_os_verify_${iso.slice(0, 8)}_${iso.slice(9, 15)}`;
}

export function buildBackupCommand() {
  return [
    "compose", "exec", "-T", "postgres", "pg_dump",
    "--clean", "--if-exists", "--format=plain", "--no-owner",
    "--no-privileges", "--username=stp_os", "--dbname=stp_os"
  ];
}

export function buildRestoreCommand(filePath, confirmed = false, database = "stp_os") {
  if (!confirmed) {
    throw new Error("Restore is destructive. Re-run with --confirm.");
  }
  if (!filePath) throw new Error("A backup file path is required.");
  return [
    "compose", "exec", "-T", "postgres", "psql",
    "--username=stp_os", `--dbname=${database}`, "--set=ON_ERROR_STOP=1"
  ];
}

export function buildCreateDatabaseCommand(database) {
  return ["compose", "exec", "-T", "postgres", "createdb", "--username=stp_os", database];
}

export function buildDropDatabaseCommand(database) {
  return ["compose", "exec", "-T", "postgres", "dropdb", "--username=stp_os", database];
}

export function buildVerifyQueryCommand(database) {
  return [
    "compose", "exec", "-T", "postgres", "psql", "--username=stp_os",
    `--dbname=${database}`, "--tuples-only", "--no-align",
    "--command=SELECT to_regclass('public.tenants'), to_regclass('public.outbox_events');"
  ];
}

function runProcess(args, input, output) {
  return new Promise((resolveProcess, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "inherit"] });
    const stream = output ? createWriteStream(output) : null;
    if (stream) child.stdout.pipe(stream);
    else child.stdout.pipe(process.stdout);
    if (input) input.pipe(child.stdin);
    else child.stdin.end();
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolveProcess();
      else reject(new Error(`docker exited with code ${code}`));
    });
  });
}

async function main() {
  const [mode = "backup", fileArgument, ...flags] = process.argv.slice(2);
  if (mode === "restore") {
    const filePath = resolve(fileArgument ?? "");
    await runProcess(buildRestoreCommand(filePath, flags.includes("--confirm")), 
      (await import("node:fs")).createReadStream(filePath));
    console.log(`PostgreSQL restore completed from ${basename(filePath)}.`);
    return;
  }
  if (mode === "verify") {
    const filePath = resolve(fileArgument ?? "");
    const database = verificationDatabaseName();
    try {
      await runProcess(buildCreateDatabaseCommand(database));
      await runProcess(buildRestoreCommand(filePath, true, database),
        (await import("node:fs")).createReadStream(filePath));
      await runProcess(buildVerifyQueryCommand(database));
      console.log(`PostgreSQL backup verified in temporary database ${database}.`);
    } finally {
      await runProcess(buildDropDatabaseCommand(database)).catch(() => {});
    }
    return;
  }
  const output = resolve(fileArgument ?? `backups/${backupFileName()}`);
  await mkdir(dirname(output), { recursive: true });
  await runProcess(buildBackupCommand(), null, output);
  console.log(`PostgreSQL backup created at ${output}.`);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
