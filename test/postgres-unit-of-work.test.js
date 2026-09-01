import assert from "node:assert/strict";
import test from "node:test";
import { PostgresUnitOfWork } from "../src/infrastructure/postgres-unit-of-work.js";

function fakePool() {
  const calls = [];
  const client = {
    async query(text) {
      calls.push(text);
      if (text === "FAIL") throw new Error("forced failure");
      return { rows: [] };
    },
    release() {}
  };
  return { calls, async connect() { return client; } };
}

test("commits aggregate and outbox work in one transaction", async () => {
  const pool = fakePool();
  const unit = new PostgresUnitOfWork(pool);
  await unit.run("park-1", async (client) => {
    await client.query("AGGREGATE");
    await client.query("OUTBOX");
  });
  assert.deepEqual(pool.calls, [
    "BEGIN",
    "SELECT set_config('app.tenant_id', $1, true)",
    "AGGREGATE",
    "OUTBOX",
    "COMMIT"
  ]);
});

test("rolls back aggregate and outbox work together on failure", async () => {
  const pool = fakePool();
  const unit = new PostgresUnitOfWork(pool);
  await assert.rejects(
    unit.run("park-1", async (client) => {
      await client.query("AGGREGATE");
      await client.query("FAIL");
    }),
    /forced failure/
  );
  assert.deepEqual(pool.calls, [
    "BEGIN",
    "SELECT set_config('app.tenant_id', $1, true)",
    "AGGREGATE",
    "FAIL",
    "ROLLBACK"
  ]);
});
