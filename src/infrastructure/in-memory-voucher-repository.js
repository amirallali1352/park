export class InMemoryVoucherRepository {
  #vouchers = new Map();
  async save(voucher) {
    this.#vouchers.set(`${voucher.tenantId}/${voucher.id}`, voucher);
    return voucher;
  }
  async find(tenantId, id) {
    return this.#vouchers.get(`${tenantId}/${id}`) ?? null;
  }
  async list(tenantId) {
    return [...this.#vouchers.values()].filter((voucher) => voucher.tenantId === tenantId);
  }
}
