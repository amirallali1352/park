import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryCertificationRepository } from "../src/infrastructure/in-memory-certification-repository.js";

test("requires certification for self-service equipment bookings", async () => {
  const certificationRepository = new InMemoryCertificationRepository();
  const server = createApiServer(undefined, { certificationRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  const booking = {
    id: "booking-cert-1", equipmentId: "eq-cert-1", userId: "user-cert-1",
    startAt: "2026-09-02T10:00:00Z", endAt: "2026-09-02T11:00:00Z"
  };
  try {
    let response = await fetch(`${base}/api/v1/equipment`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "eq-cert-1", name: "SEM", type: "sem",
        accessModel: "certified_self_service"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/bookings`, {
      method: "POST", headers, body: JSON.stringify(booking)
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: {
        code: "CERTIFICATION_REQUIRED",
        message: "A valid equipment certification is required."
      }
    });

    response = await fetch(`${base}/api/v1/equipment/eq-cert-1/certifications`, {
      method: "POST", headers,
      body: JSON.stringify({ id: "cert-1", userId: "user-cert-1", expiresAt: "2027-09-02T00:00:00Z" })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/bookings`, {
      method: "POST", headers, body: JSON.stringify({ ...booking, id: "booking-cert-2" })
    });
    assert.equal(response.status, 201);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
