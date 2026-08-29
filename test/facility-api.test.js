import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";

async function withServer(run) {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    return await run(`http://${address.address}:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("creates and lists equipment within a tenant", async () => {
  await withServer(async (baseUrl) => {
    let response = await fetch(`${baseUrl}/api/v1/equipment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        id: "eq-1", name: "HPLC", type: "hplc", accessModel: "operator_assisted"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/equipment`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((item) => item.id), ["eq-1"]);
  });
});

test("creates a booking and rejects an overlapping booking", async () => {
  await withServer(async (baseUrl) => {
    const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
    let response = await fetch(`${baseUrl}/api/v1/equipment`, {
      method: "POST", headers,
      body: JSON.stringify({ id: "eq-1", name: "SEM", type: "sem", accessModel: "operator_assisted" })
    });
    assert.equal(response.status, 201);
    const booking = {
      id: "b-1", equipmentId: "eq-1", userId: "u-1",
      startAt: "2026-09-01T10:00:00Z", endAt: "2026-09-01T11:00:00Z"
    };
    response = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: "POST", headers, body: JSON.stringify(booking)
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: "POST", headers,
      body: JSON.stringify({ ...booking, id: "b-2", startAt: "2026-09-01T10:30:00Z" })
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: { code: "BOOKING_CONFLICT", message: "Equipment is already booked for this time range." }
    });
  });
});
