export class RedpandaEventBus {
  #producer;

  constructor(producer) {
    if (!producer || typeof producer.send !== "function") {
      throw new TypeError("A Redpanda producer with a send method is required.");
    }
    this.#producer = producer;
  }

  async publish(event) {
    await this.#producer.send({
      topic: event.type,
      messages: [{
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          "event-id": event.id,
          "tenant-id": event.tenantId
        }
      }]
    });
  }
}
