export class InMemoryBillingRepository {
  #subscriptions = new Map();
  #invoices = new Map();

  async saveSubscription(subscription) {
    this.#subscriptions.set(`${subscription.tenantId}/${subscription.id}`, subscription);
    return subscription;
  }

  async findSubscription(tenantId, id) {
    return this.#subscriptions.get(`${tenantId}/${id}`) ?? null;
  }

  async listSubscriptions(tenantId) {
    return [...this.#subscriptions.values()].filter((item) => item.tenantId === tenantId);
  }

  async saveInvoice(invoice) {
    this.#invoices.set(`${invoice.tenantId}/${invoice.id}`, invoice);
    return invoice;
  }

  async findInvoice(tenantId, id) {
    return this.#invoices.get(`${tenantId}/${id}`) ?? null;
  }

  async listInvoices(tenantId) {
    return [...this.#invoices.values()].filter((item) => item.tenantId === tenantId);
  }
}
