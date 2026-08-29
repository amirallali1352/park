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
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health endpoint reports the API is running", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", service: "stp-os" });
  });
});

test("creates a tenant and returns a public tenant representation", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tenants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "park-1", name: "Tehran STP", type: "park" })
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: "park-1",
      name: "Tehran STP",
      type: "park"
    });
  });
});

test("rejects malformed tenant requests with a stable error contract", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tenants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "park-1", name: "", type: "invalid" })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_TENANT", message: "Tenant id, name and a valid type are required." }
    });
  });
});

test("lists users only within the authenticated tenant", async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/v1/tenants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "park-1", name: "Park", type: "park" })
    });
    await fetch(`${baseUrl}/api/v1/users`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ id: "u1", email: "ADMIN@PARK.TEST", role: "park_admin" })
    });
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      { id: "u1", tenantId: "park-1", email: "admin@park.test", role: "park_admin" }
    ]);
  });
});

test("denies user access when tenant context is missing", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "TENANT_CONTEXT_REQUIRED", message: "x-tenant-id header is required." }
    });
  });
});
