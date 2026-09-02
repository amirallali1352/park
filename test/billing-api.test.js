import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";

test("creates a subscription, invoice, and provider-backed payment through the API", async () => {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    let response = await fetch(`${base}/api/v1/billing/subscriptions`, {
      method: "POST", headers,
      body: JSON.stringify({ id: "sub-api-1", planCode: "enterprise", currency: "TRY" })
    });
    assert.equal(response.status, 201);
    const subscription = await response.json();
    assert.equal(subscription.amount, 14990);

    response = await fetch(`${base}/api/v1/billing/invoices`, {
      method: "POST", headers,
      body: JSON.stringify({ id: "inv-api-1", subscriptionId: subscription.id })
    });
    assert.equal(response.status, 201);

    response = await fetch(`${base}/api/v1/billing/invoices/inv-api-1/pay`, {
      method: "POST", headers
    });
    assert.equal(response.status, 200);
    const paid = await response.json();
    assert.equal(paid.invoice.status, "paid");
    assert.equal(paid.payment.status, "succeeded");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
