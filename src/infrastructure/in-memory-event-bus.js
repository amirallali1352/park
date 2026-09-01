export class InMemoryEventBus {
  messages = [];

  async publish(event) {
    this.messages.push({
      topic: event.type,
      type: event.type,
      tenantId: event.tenantId,
      payload: event.payload
    });
  }
}
