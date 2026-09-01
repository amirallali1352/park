import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryAuditRepository } from "../src/infrastructure/in-memory-audit-repository.js";

test("records a hash-chained audit event for a booking", async () => {
  const audit = new InMemoryAuditRepository();
  const server = createApiServer(undefined, { auditRepository: audit });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${base}/api/v1/equipment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ id: "eq-1", name: "HPLC", type: "hplc", accessModel: "operator_assisted" })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        id: "b-1", equipmentId: "eq-1", userId: "u-1",
        startAt: "2026-09-20T10:00:00Z", endAt: "2026-09-20T11:00:00Z"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/audit`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    const events = await response.json();
    assert.equal(events.some((event) => event.action === "booking.created"), true);
    assert.equal(events[0].action, "equipment.created");
    assert.equal(events[0].previousHash, null);
    assert.equal(events[1].action, "booking.created");
    assert.equal(events[1].previousHash, events[0].hash);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
