import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";

test("waits for asynchronous tenant writes before responding", async () => {
  let persisted = false;
  const server = createApiServer({
    async saveTenant() {
      await new Promise((resolve) => setTimeout(resolve, 15));
      persisted = true;
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://${address.address}:${address.port}/api/v1/tenants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "tenant-async", name: "Async Park", type: "park" })
    });
    assert.equal(response.status, 201);
    assert.equal(persisted, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("waits for asynchronous user writes before responding", async () => {
  let persisted = false;
  const server = createApiServer({
    async saveUser() {
      await new Promise((resolve) => setTimeout(resolve, 15));
      persisted = true;
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://${address.address}:${address.port}/api/v1/users`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ id: "user-async", email: "async@test.local", role: "member" })
    });
    assert.equal(response.status, 201);
    assert.equal(persisted, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
