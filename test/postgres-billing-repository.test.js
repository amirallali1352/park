import assert from "node:assert/strict";
import test from "node:test";
import { PostgresBillingRepository } from "../src/infrastructure/postgres-billing-repository.js";

test("persists subscriptions and invoices with tenant-scoped SQL", async () => {
  const calls = [];
  const pool = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO subscriptions")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], plan_code: values[2], currency: values[3],
          amount: values[4], status: values[5], created_at: values[6], updated_at: values[7]
        }] };
      }
      if (text.includes("INSERT INTO billing_invoices")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], subscription_id: values[2],
          amount: values[3], currency: values[4], status: values[5], provider: values[6],
          payment_id: values[7], created_at: values[8], updated_at: values[9]
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresBillingRepository(pool);
  await repository.saveSubscription({
    id: "sub-1", tenantId: "park-1", planCode: "startup",
    currency: "TRY", amount: 1990, status: "active",
    createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z"
  });
  await repository.saveInvoice({
    id: "inv-1", tenantId: "park-1", subscriptionId: "sub-1",
    amount: 1990, currency: "TRY", status: "open", paymentId: null,
    createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z"
  });
  assert.ok(calls.some((call) => call.text.includes("set_config('app.tenant_id'")));
  const subscriptionCall = calls.find((call) => call.text.includes("INSERT INTO subscriptions"));
  const invoiceCall = calls.find((call) => call.text.includes("INSERT INTO billing_invoices"));
  assert.match(subscriptionCall.text, /tenant_id/);
  assert.match(invoiceCall.text, /tenant_id/);
});
