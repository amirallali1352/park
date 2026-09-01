import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryEventBus } from "../src/infrastructure/in-memory-event-bus.js";

test("publishes events to a topic named after the event type", async () => {
  const bus = new InMemoryEventBus();
  await bus.publish({ type: "SampleReceived", tenantId: "park-1", payload: { sampleId: "s-1" } });
  assert.deepEqual(bus.messages, [{
    topic: "SampleReceived",
    type: "SampleReceived",
    tenantId: "park-1",
    payload: { sampleId: "s-1" }
  }]);
});
