import test from "node:test";
import assert from "node:assert/strict";
import { backupFileName, buildBackupCommand, buildRestoreCommand } from "../scripts/postgres-backup.mjs";

test("creates a deterministic timestamped PostgreSQL backup filename", () => {
  assert.equal(
    backupFileName(new Date("2026-09-02T12:34:56.000Z")),
    "stp-os-20260902-123456Z.sql"
  );
});

test("builds a non-interactive Docker PostgreSQL dump command", () => {
  assert.deepEqual(buildBackupCommand(), [
    "compose",
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "--clean",
    "--if-exists",
    "--format=plain",
    "--no-owner",
    "--no-privileges",
    "--username=stp_os",
    "--dbname=stp_os"
  ]);
});

test("requires explicit confirmation before building a destructive restore command", () => {
  assert.throws(
    () => buildRestoreCommand("backups/stp-os.sql"),
    /--confirm/
  );
  assert.deepEqual(buildRestoreCommand("backups/stp-os.sql", true), [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "--username=stp_os",
    "--dbname=stp_os",
    "--set=ON_ERROR_STOP=1"
  ]);
});
