import { randomUUID } from "node:crypto";

export class MemoryPaymentProvider {
  name = "memory";
  #payments = new Map();

  async createPayment({ tenantId, invoiceId, amount, currency } = {}) {
    if (!tenantId || !invoiceId || !Number.isFinite(amount) || amount <= 0 || !currency) {
      const error = new Error("A valid payment amount and context are required.");
      error.code = "INVALID_PAYMENT";
      throw error;
    }
    const payment = Object.freeze({
      id: randomUUID(), tenantId, invoiceId, amount, currency: currency.toUpperCase(),
      status: "succeeded", provider: this.name, createdAt: new Date().toISOString()
    });
    this.#payments.set(`${tenantId}/${payment.id}`, payment);
    return payment;
  }

  async getPayment(id, tenantId) {
    if (tenantId) return this.#payments.get(`${tenantId}/${id}`) ?? null;
    return [...this.#payments.values()].find((payment) => payment.id === id) ?? null;
  }
}
