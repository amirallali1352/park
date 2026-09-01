export class InMemoryOutboxRepository {
  #events = new Map();

  async save(event) {
    this.#events.set(event.id, event);
    return event;
  }

  async find(id) {
    return this.#events.get(id) ?? null;
  }

  async listPending(limit = 100) {
    return [...this.#events.values()]
      .filter((event) => event.status === "pending")
      .slice(0, limit);
  }

  async markPublished(id, publishedAt = new Date().toISOString()) {
    const event = this.#events.get(id);
    if (!event) return null;
    const published = Object.freeze({ ...event, status: "published", publishedAt });
    this.#events.set(id, published);
    return published;
  }
}
