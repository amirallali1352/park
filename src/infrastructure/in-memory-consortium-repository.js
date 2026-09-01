export class InMemoryConsortiumRepository {
  #consortia = new Map();
  async save(consortium) {
    this.#consortia.set(`${consortium.tenantId}/${consortium.id}`, consortium);
    return consortium;
  }
  async find(tenantId, id) {
    return this.#consortia.get(`${tenantId}/${id}`) ?? null;
  }
  async list(tenantId) {
    return [...this.#consortia.values()].filter((item) => item.tenantId === tenantId);
  }
}
