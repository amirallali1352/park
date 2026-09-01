export class InMemoryCertificationRepository {
  #certifications = new Map();

  async save(certification) {
    this.#certifications.set(`${certification.tenantId}/${certification.id}`, certification);
    return certification;
  }

  async findValid(tenantId, equipmentId, userId, at = new Date()) {
    return [...this.#certifications.values()].find((item) =>
      item.tenantId === tenantId && item.equipmentId === equipmentId &&
      item.userId === userId && new Date(item.expiresAt) > new Date(at)
    ) ?? null;
  }

  async list(tenantId, equipmentId) {
    return [...this.#certifications.values()].filter((item) =>
      item.tenantId === tenantId && (!equipmentId || item.equipmentId === equipmentId)
    );
  }
}
