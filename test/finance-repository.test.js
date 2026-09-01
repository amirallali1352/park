import assert from "node:assert/strict";
import test from "node:test";
import { PostgresFinanceRepository } from "../src/infrastructure/postgres-finance-repository.js";

test("persists escrow transactions with tenant context", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO escrow_transactions")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], payer_id: values[2], payee_id: values[3],
          currency: values[4], amount: values[5], reference_id: values[6],
          status: values[7], created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z"
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresFinanceRepository(client);
  const escrow = {
    id: "escrow-1", tenantId: "park-1", payerId: "a", payeeId: "b",
    currency: "TRY", amount: 100, referenceId: "r", status: "locked",
    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
  };
  assert.deepEqual(await repository.save(escrow), escrow);
  assert.equal(calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(calls[1].text, /INSERT INTO escrow_transactions/);
});
