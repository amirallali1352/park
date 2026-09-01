import assert from "node:assert/strict";
import test from "node:test";
import { RedpandaEventBus } from "../src/infrastructure/redpanda-event-bus.js";

test("publishes an event to a Redpanda topic", async () => {
  let request;
  const bus = new RedpandaEventBus({
    async send(value) {
      request = value;
    }
  });
  await bus.publish({
    type: "BookingConfirmed",
    aggregateId: "booking-1",
    tenantId: "park-1",
    payload: { equipmentId: "eq-1" }
  });
  assert.equal(request.topic, "BookingConfirmed");
  assert.equal(request.messages[0].key, "booking-1");
  assert.deepEqual(JSON.parse(request.messages[0].value), {
    type: "BookingConfirmed",
    aggregateId: "booking-1",
    tenantId: "park-1",
    payload: { equipmentId: "eq-1" }
  });
});

test("includes an event id and tenant headers for idempotent consumers", async () => {
  let request;
  const bus = new RedpandaEventBus({
    async send(value) {
      request = value;
    }
  });
  await bus.publish({
    id: "event-headers-1",
    type: "VoucherApplied",
    aggregateId: "voucher-1",
    tenantId: "park-1",
    payload: {}
  });
  assert.deepEqual(request.messages[0].headers, {
    "event-id": "event-headers-1",
    "tenant-id": "park-1"
  });
});
