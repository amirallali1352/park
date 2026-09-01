import assert from "node:assert/strict";
import test from "node:test";
import { PostgresVoucherRepository } from "../src/infrastructure/postgres-voucher-repository.js";

test("persists vouchers with tenant context", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO vouchers")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], beneficiary_id: values[2],
          program: values[3], currency: values[4], amount: values[5],
          redeemed_amount: values[6], status: values[7],
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z"
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresVoucherRepository(client);
  const voucher = {
    id: "v-1", tenantId: "park-1", beneficiaryId: "startup-1",
    program: "EU", currency: "EUR", amount: 100, redeemedAmount: 0,
    status: "active", createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z"
  };
  assert.deepEqual(await repository.save(voucher), voucher);
  assert.equal(calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(calls[1].text, /INSERT INTO vouchers/);
});
