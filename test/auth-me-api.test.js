import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { createAccessToken } from "../src/security/auth.js";

test("returns the authenticated user's safe profile", async () => {
  const server = createApiServer(undefined, {
    authRequired: true,
    authSecret: "test-secret"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = createAccessToken(
    { sub: "user-1", tenantId: "park-1", role: "tenant_admin", email: "admin@park.local" },
    { secret: "test-secret" }
  );
  try {
    const response = await fetch(`${base}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: {
        id: "user-1",
        tenantId: "park-1",
        role: "tenant_admin",
        email: "admin@park.local"
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("requires authentication for the current-user profile", async () => {
  const server = createApiServer(undefined, {
    authRequired: true,
    authSecret: "test-secret"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/me`);
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
