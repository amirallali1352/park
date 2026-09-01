import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryFinanceRepository } from "../src/infrastructure/in-memory-finance-repository.js";

test("creates, approves, and releases escrow through the API", async () => {
  const financeRepository = new InMemoryFinanceRepository();
  const server = createApiServer(undefined, { financeRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    let response = await fetch(`${base}/api/v1/finance/escrows`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "escrow-api-1", payerId: "startup-1", payeeId: "lab-1",
        currency: "TRY", amount: 5000, referenceId: "booking-1"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/finance/escrows/escrow-api-1/approve`, {
      method: "POST", headers
    });
    assert.equal((await response.json()).status, "approved");
    response = await fetch(`${base}/api/v1/finance/escrows/escrow-api-1/release`, {
      method: "POST", headers
    });
    assert.equal((await response.json()).status, "released");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
