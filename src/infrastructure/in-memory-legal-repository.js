export class InMemoryLegalRepository {
  #contracts = new Map();

  async save(contract) {
    this.#contracts.set(`${contract.tenantId}/${contract.id}`, contract);
    return contract;
  }

  async find(tenantId, id) {
    return this.#contracts.get(`${tenantId}/${id}`) ?? null;
  }

  async list(tenantId) {
    return [...this.#contracts.values()].filter((contract) => contract.tenantId === tenantId);
  }

  async hasActiveAgreement(tenantId) {
    return (await this.list(tenantId)).some((contract) => contract.status === "active");
  }
}
