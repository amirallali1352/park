import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export function backupFileName(date = new Date()) {
  const iso = date.toISOString().replace(/[-:]/g, "").replace(".000Z", "Z");
  return `stp-os-${iso.slice(0, 8)}-${iso.slice(9, 15)}Z.sql`;
}

export function buildBackupCommand() {
  return [
    "compose", "exec", "-T", "postgres", "pg_dump",
    "--clean", "--if-exists", "--format=plain", "--no-owner",
    "--no-privileges", "--username=stp_os", "--dbname=stp_os"
  ];
}

export function buildRestoreCommand(filePath, confirmed = false) {
  if (!confirmed) {
    throw new Error("Restore is destructive. Re-run with --confirm.");
  }
  if (!filePath) throw new Error("A backup file path is required.");
  return [
    "compose", "exec", "-T", "postgres", "psql",
    "--username=stp_os", "--dbname=stp_os", "--set=ON_ERROR_STOP=1"
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
