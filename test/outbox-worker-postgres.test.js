import assert from "node:assert/strict";
import test from "node:test";
import { PostgresOutboxRepository } from "../src/infrastructure/postgres-outbox-repository.js";

test("lists pending events with a bounded query", async () => {
  let call;
  const client = {
    async query(text, values) {
      call = { text, values };
      return { rows: [] };
    }
  };
  const repository = new PostgresOutboxRepository(client);
  assert.deepEqual(await repository.listPending(25), []);
  assert.match(call.text, /status = 'pending'/);
  assert.deepEqual(call.values, [25]);
});
