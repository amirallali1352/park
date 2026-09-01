import assert from "node:assert/strict";
import test from "node:test";
import { createDomainEvent } from "../src/domain/outbox.js";
import { InMemoryOutboxRepository } from "../src/infrastructure/in-memory-outbox-repository.js";

test("stores pending events and marks them published", async () => {
  const repository = new InMemoryOutboxRepository();
  const event = createDomainEvent({
    id: "event-1", tenantId: "park-1", type: "SampleReceived",
    aggregateId: "sample-1", payload: { barcode: "S-1" }
  });
  await repository.save(event);
  assert.deepEqual(await repository.listPending(), [event]);
  await repository.markPublished(event.id, "2026-09-01T10:01:00Z");
  assert.deepEqual(await repository.listPending(), []);
  assert.equal((await repository.find(event.id)).status, "published");
});
