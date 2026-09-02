import assert from "node:assert/strict";
import test from "node:test";
import { loadMigrations } from "../src/infrastructure/load-migrations.js";

test("loads SQL migrations in numeric order", async () => {
  const migrations = await loadMigrations("db");
  assert.ok(migrations.length >= 13);
  assert.equal(migrations[0].name, "001_identity.sql");
  assert.equal(migrations.at(-1).name, "014_billing.sql");
  assert.match(migrations[0].sql, /CREATE TABLE IF NOT EXISTS tenants/);
});
