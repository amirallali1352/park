import assert from "node:assert/strict";
import test from "node:test";
import { createDomainEvent } from "../src/domain/outbox.js";
import { InMemoryOutboxRepository } from "../src/infrastructure/in-memory-outbox-repository.js";
import { InMemoryEventBus } from "../src/infrastructure/in-memory-event-bus.js";
import { OutboxWorker } from "../src/infrastructure/outbox-worker.js";

function event(id) {
  return createDomainEvent({
    id,
    tenantId: "park-1",
    type: "BookingConfirmed",
    aggregateId: `booking-${id}`,
    payload: { id }
  });
}

test("publishes pending events and marks them published", async () => {
  const outbox = new InMemoryOutboxRepository();
  const bus = new InMemoryEventBus();
  await outbox.save(event("event-1"));
  const worker = new OutboxWorker({ outboxRepository: outbox, eventBus: bus });

  const result = await worker.runOnce();

  assert.deepEqual(result, { scanned: 1, published: 1, failed: 0 });
  assert.equal((await outbox.find("event-1")).status, "published");
  assert.deepEqual(bus.messages.map((message) => message.type), ["BookingConfirmed"]);
});

test("leaves events pending when publishing fails", async () => {
  const outbox = new InMemoryOutboxRepository();
  const bus = { async publish() { throw new Error("broker unavailable"); } };
  await outbox.save(event("event-2"));
  const worker = new OutboxWorker({ outboxRepository: outbox, eventBus: bus });

  const result = await worker.runOnce();

  assert.deepEqual(result, { scanned: 1, published: 0, failed: 1 });
  assert.equal((await outbox.find("event-2")).status, "pending");
});
