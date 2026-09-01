export class InMemoryFinanceRepository {
  #escrows = new Map();

  async save(escrow) {
    this.#escrows.set(`${escrow.tenantId}/${escrow.id}`, escrow);
    return escrow;
  }

  async find(tenantId, id) {
    return this.#escrows.get(`${tenantId}/${id}`) ?? null;
  }

  async list(tenantId) {
    return [...this.#escrows.values()].filter((escrow) => escrow.tenantId === tenantId);
  }
}
