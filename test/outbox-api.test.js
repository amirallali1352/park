import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryOutboxRepository } from "../src/infrastructure/in-memory-outbox-repository.js";

test("creates a booking and exposes its pending outbox event", async () => {
  const outbox = new InMemoryOutboxRepository();
  const server = createApiServer(undefined, { outboxRepository: outbox });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${baseUrl}/api/v1/equipment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        id: "eq-1", name: "HPLC", type: "hplc", accessModel: "operator_assisted"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        id: "booking-1", equipmentId: "eq-1", userId: "u-1",
        startAt: "2026-09-05T10:00:00Z", endAt: "2026-09-05T11:00:00Z"
      })
    });
    assert.equal(response.status, 201);
    const events = await outbox.listPending();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "BookingConfirmed");
    assert.equal(events[0].aggregateId, "booking-1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
