export const SubscriptionStatus = Object.freeze({
  ACTIVE: "active",
  CANCELED: "canceled"
});

export const InvoiceStatus = Object.freeze({
  OPEN: "open",
  PAID: "paid"
});

export const BillingPlans = Object.freeze({
  startup: 1990,
  academic: 990,
  enterprise: 14990
});

export class BillingError extends Error {
  constructor(message, code = "BILLING_ERROR") {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

const timestamp = () => new Date().toISOString();

export function createSubscription({ id, tenantId, planCode, currency } = {}) {
  if (!id || !tenantId || !BillingPlans[planCode] || !currency) {
    throw new BillingError("A valid plan, tenant and currency are required.", "INVALID_PLAN");
  }
  const now = timestamp();
  return Object.freeze({
    id, tenantId, planCode, currency: currency.toUpperCase(),
    amount: BillingPlans[planCode], status: SubscriptionStatus.ACTIVE,
    createdAt: now, updatedAt: now
  });
}

export function createInvoice({ id, tenantId, subscriptionId, amount, currency } = {}) {
  if (!id || !tenantId || !subscriptionId || !Number.isFinite(amount) || amount <= 0 || !currency) {
    throw new BillingError("A valid subscription, amount and currency are required.", "INVALID_INVOICE");
  }
  const now = timestamp();
  return Object.freeze({
    id, tenantId, subscriptionId, amount, currency: currency.toUpperCase(),
    status: InvoiceStatus.OPEN, paymentId: null, createdAt: now, updatedAt: now
  });
}

export function markInvoicePaid(invoice, { provider, paymentId } = {}) {
  if (invoice.status !== InvoiceStatus.OPEN) {
    throw new BillingError("Only an open invoice can be paid.", "INVOICE_NOT_OPEN");
  }
  if (!provider || !paymentId) {
    throw new BillingError("Payment provider and payment ID are required.", "INVALID_PAYMENT");
  }
  return Object.freeze({
    ...invoice, status: InvoiceStatus.PAID, provider, paymentId, updatedAt: timestamp()
  });
}
