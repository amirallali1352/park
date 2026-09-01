export class InMemoryMarketplaceRepository {
  #listings = new Map();

  async save(listing) {
    this.#listings.set(`${listing.tenantId}/${listing.id}`, listing);
    return listing;
  }

  async find(tenantId, id) {
    return this.#listings.get(`${tenantId}/${id}`) ?? null;
  }

  async list(tenantId, { type, tag, status = "open" } = {}) {
    return [...this.#listings.values()].filter((listing) =>
      listing.tenantId === tenantId &&
      (!status || listing.status === status) &&
      (!type || listing.type === type) &&
      (!tag || listing.tags.includes(tag))
    );
  }

  async discover({ type, tag, status = "open" } = {}) {
    return [...this.#listings.values()].filter((listing) =>
      (!status || listing.status === status) &&
      (!type || listing.type === type) &&
      (!tag || listing.tags.includes(tag))
    );
  }
}
