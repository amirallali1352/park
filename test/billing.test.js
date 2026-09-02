import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoiceStatus,
  SubscriptionStatus,
  createInvoice,
  createSubscription,
  markInvoicePaid
} from "../src/domain/billing.js";

test("creates a tenant subscription from a supported plan", () => {
  const subscription = createSubscription({
    id: "sub-1",
    tenantId: "park-1",
    planCode: "startup",
    currency: "TRY"
  });

  assert.equal(subscription.status, SubscriptionStatus.ACTIVE);
  assert.equal(subscription.planCode, "startup");
  assert.equal(subscription.amount, 1990);
  assert.equal(subscription.currency, "TRY");
});

test("creates an invoice and transitions it to paid", () => {
  const subscription = createSubscription({
    id: "sub-2", tenantId: "park-1", planCode: "academic", currency: "TRY"
  });
  let invoice = createInvoice({
    id: "inv-1", tenantId: "park-1", subscriptionId: subscription.id,
    amount: subscription.amount, currency: subscription.currency
  });
  assert.equal(invoice.status, InvoiceStatus.OPEN);
  invoice = markInvoicePaid(invoice, { provider: "memory", paymentId: "pay-1" });
  assert.equal(invoice.status, InvoiceStatus.PAID);
  assert.equal(invoice.paymentId, "pay-1");
});

test("rejects invalid plans and duplicate payment", () => {
  assert.throws(() => createSubscription({
    id: "bad", tenantId: "park-1", planCode: "unknown", currency: "TRY"
  }), { code: "INVALID_PLAN" });
  const invoice = createInvoice({
    id: "inv-2", tenantId: "park-1", subscriptionId: "sub-1",
    amount: 100, currency: "TRY"
  });
  const paid = markInvoicePaid(invoice, { provider: "memory", paymentId: "pay-2" });
  assert.throws(() => markInvoicePaid(paid, { provider: "memory", paymentId: "pay-3" }), {
    code: "INVOICE_NOT_OPEN"
  });
});
