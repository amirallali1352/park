import assert from "node:assert/strict";
import test from "node:test";
import { createDomainEvent } from "../src/domain/outbox.js";

test("creates a versioned immutable domain event", () => {
  const event = createDomainEvent({
    id: "event-1",
    tenantId: "park-1",
    type: "BookingConfirmed",
    aggregateId: "booking-1",
    payload: { equipmentId: "eq-1" },
    occurredAt: "2026-09-01T10:00:00Z"
  });
  assert.deepEqual(event, {
    id: "event-1",
    tenantId: "park-1",
    type: "BookingConfirmed",
    version: 1,
    aggregateId: "booking-1",
    payload: { equipmentId: "eq-1" },
    occurredAt: "2026-09-01T10:00:00.000Z",
    status: "pending"
  });
});

test("rejects unsupported or incomplete events", () => {
  assert.throws(
    () => createDomainEvent({
      id: "event-1", tenantId: "park-1", type: "UnknownEvent",
      aggregateId: "a-1", payload: {}
    }),
    { code: "INVALID_DOMAIN_EVENT" }
  );
});
