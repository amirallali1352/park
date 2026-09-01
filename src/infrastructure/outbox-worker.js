export class OutboxWorker {
  #outboxRepository;
  #eventBus;
  #batchSize;

  constructor({ outboxRepository, eventBus, batchSize = 100 }) {
    if (!outboxRepository || typeof outboxRepository.listPending !== "function" ||
        typeof outboxRepository.markPublished !== "function") {
      throw new TypeError("A compatible outbox repository is required.");
    }
    if (!eventBus || typeof eventBus.publish !== "function") {
      throw new TypeError("A compatible event bus is required.");
    }
    this.#outboxRepository = outboxRepository;
    this.#eventBus = eventBus;
    this.#batchSize = batchSize;
  }

  async runOnce() {
    const events = await this.#outboxRepository.listPending(this.#batchSize);
    let published = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await this.#eventBus.publish(event);
        await this.#outboxRepository.markPublished(event.id, undefined, event.tenantId);
        published += 1;
      } catch {
        failed += 1;
      }
    }
    return { scanned: events.length, published, failed };
  }
}
