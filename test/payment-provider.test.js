import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPaymentProvider } from "../src/infrastructure/memory-payment-provider.js";

test("memory payment provider creates and retrieves a payment", async () => {
  const provider = new MemoryPaymentProvider();
  const payment = await provider.createPayment({
    tenantId: "park-1", invoiceId: "inv-1", amount: 1990, currency: "TRY"
  });

  assert.equal(payment.status, "succeeded");
  assert.equal((await provider.getPayment(payment.id)).invoiceId, "inv-1");
});

test("payment providers expose a stable payment contract", async () => {
  const provider = new MemoryPaymentProvider();
  await assert.rejects(
    () => provider.createPayment({ tenantId: "park-1", invoiceId: "inv-1", amount: 0, currency: "TRY" }),
    { code: "INVALID_PAYMENT" }
  );
});
