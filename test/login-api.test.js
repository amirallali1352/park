import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { createUser } from "../src/domain/identity.js";
import { hashPassword } from "../src/security/password.js";
import { InMemoryIdentityRepository } from "../src/infrastructure/in-memory-identity-repository.js";

test("logs in with email and returns a tenant-scoped JWT", async () => {
  const repository = new InMemoryIdentityRepository();
  await repository.saveTenant({ id: "park-1", name: "Park", type: "park" });
  await repository.saveUser({
    ...createUser({ id: "admin-1", tenantId: "park-1", email: "admin@park.local", role: "park_admin" }),
    passwordHash: await hashPassword("Admin-pass-123!")
  });
  const server = createApiServer(repository, {
    authSecret: "test-secret",
    authRequired: true
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ADMIN@PARK.LOCAL", password: "Admin-pass-123!", tenantId: "park-1"
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.id, "admin-1");
    assert.equal(body.user.tenantId, "park-1");
    assert.equal(typeof body.accessToken, "string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rejects invalid login credentials", async () => {
  const repository = new InMemoryIdentityRepository();
  await repository.saveTenant({ id: "park-1", name: "Park", type: "park" });
  await repository.saveUser({
    ...createUser({ id: "admin-1", tenantId: "park-1", email: "admin@park.local", role: "park_admin" }),
    passwordHash: await hashPassword("Admin-pass-123!")
  });
  const server = createApiServer(repository, { authSecret: "test-secret" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@park.local", password: "wrong-password" })
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_CREDENTIALS", message: "Email or password is invalid." }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("creates a user with a hashed password", async () => {
  const repository = new InMemoryIdentityRepository();
  await repository.saveTenant({ id: "park-1", name: "Park", type: "park" });
  const server = createApiServer(repository);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/v1/users`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        id: "user-1", email: "user@park.local", password: "User-pass-123!"
      })
    });
    assert.equal(response.status, 201);
    const stored = await repository.findUserByEmail("user@park.local", "park-1");
    assert.equal(typeof stored.passwordHash, "string");
    assert.notEqual(stored.passwordHash, "User-pass-123!");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
