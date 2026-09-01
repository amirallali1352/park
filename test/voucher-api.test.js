import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryFinanceRepository } from "../src/infrastructure/in-memory-finance-repository.js";
import { InMemoryVoucherRepository } from "../src/infrastructure/in-memory-voucher-repository.js";

test("creates a voucher and applies it to an escrow through the API", async () => {
  const financeRepository = new InMemoryFinanceRepository();
  const voucherRepository = new InMemoryVoucherRepository();
  const server = createApiServer(undefined, { financeRepository, voucherRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    await fetch(`${base}/api/v1/finance/escrows`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "escrow-voucher-1", payerId: "startup-1", payeeId: "lab-1",
        currency: "TRY", amount: 2000, referenceId: "booking-voucher-1"
      })
    });
    let response = await fetch(`${base}/api/v1/finance/vouchers`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "voucher-api-1", beneficiaryId: "startup-1",
        program: "TÜBİTAK", currency: "TRY", amount: 1000
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/finance/escrows/escrow-voucher-1/apply-voucher`, {
      method: "POST", headers,
      body: JSON.stringify({ voucherId: "voucher-api-1", amount: 750 })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).appliedAmount, 750);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
