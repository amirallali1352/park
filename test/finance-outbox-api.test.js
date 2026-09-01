import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryFinanceRepository } from "../src/infrastructure/in-memory-finance-repository.js";
import { InMemoryOutboxRepository } from "../src/infrastructure/in-memory-outbox-repository.js";
import { InMemoryVoucherRepository } from "../src/infrastructure/in-memory-voucher-repository.js";

test("writes escrow and voucher lifecycle events to the outbox", async () => {
  const outboxRepository = new InMemoryOutboxRepository();
  const server = createApiServer(undefined, {
    financeRepository: new InMemoryFinanceRepository(),
    voucherRepository: new InMemoryVoucherRepository(),
    outboxRepository
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    let response = await fetch(`${base}/api/v1/finance/escrows`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "escrow-event-1", payerId: "startup-1", payeeId: "lab-1",
        currency: "TRY", amount: 2000, referenceId: "booking-event-1"
      })
    });
    assert.equal(response.status, 201);

    response = await fetch(`${base}/api/v1/finance/escrows/escrow-event-1/approve`, {
      method: "POST", headers
    });
    assert.equal(response.status, 200);

    response = await fetch(`${base}/api/v1/finance/vouchers`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "voucher-event-1", beneficiaryId: "startup-1",
        program: "TUBITAK", currency: "TRY", amount: 1000
      })
    });
    assert.equal(response.status, 201);

    response = await fetch(`${base}/api/v1/finance/escrows/escrow-event-1/apply-voucher`, {
      method: "POST", headers,
      body: JSON.stringify({ voucherId: "voucher-event-1", amount: 750 })
    });
    assert.equal(response.status, 200);

    response = await fetch(`${base}/api/v1/finance/escrows/escrow-event-1/release`, {
      method: "POST", headers
    });
    assert.equal(response.status, 200);

    const events = await outboxRepository.listPending();
    assert.deepEqual(events.map((event) => event.type), [
      "EscrowCreated", "EscrowApproved", "VoucherIssued", "VoucherApplied", "EscrowReleased"
    ]);
    const voucherApplied = events.find((event) => event.type === "VoucherApplied");
    assert.equal(voucherApplied.aggregateId, "voucher-event-1");
    assert.equal(voucherApplied.payload.escrowId, "escrow-event-1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
