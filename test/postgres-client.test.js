import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres-client.js";

test("creates a PostgreSQL pool from a database URL", () => {
  let options;
  class FakePool {
    constructor(value) {
      options = value;
    }
  }

  const pool = createPostgresPool({
    Pool: FakePool,
    connectionString: "postgres://stp:test@localhost:5432/stp_os"
  });

  assert.ok(pool instanceof FakePool);
  assert.deepEqual(options, {
    connectionString: "postgres://stp:test@localhost:5432/stp_os",
    max: 10
  });
});

test("runs migrations in order using one client transaction", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
    },
    release() {
      calls.push("release");
    }
  };
  const pool = {
    async connect() {
      calls.push("connect");
      return client;
    }
  };

  await runMigrations(pool, [
    { name: "001_identity.sql", sql: "CREATE TABLE tenants (id text);" },
    { name: "002_users.sql", sql: "CREATE TABLE users (id text);" }
  ]);

  assert.deepEqual(calls, [
    "connect",
    "BEGIN",
    "CREATE TABLE tenants (id text);",
    "CREATE TABLE users (id text);",
    "COMMIT",
    "release"
  ]);
});
