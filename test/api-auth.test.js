import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { createAccessToken } from "../src/security/auth.js";

async function withAuthServer(run) {
  const server = createApiServer(undefined, { authRequired: true, authSecret: "test-secret" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    return await run(`http://${address.address}:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("requires a bearer token when authentication is enabled", async () => {
  await withAuthServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "AUTH_REQUIRED", message: "Bearer access token is required." }
    });
  });
});

test("derives tenant context from the token and rejects header spoofing", async () => {
  await withAuthServer(async (baseUrl) => {
    const token = createAccessToken(
      { sub: "user-1", tenantId: "park-1", role: "member" },
      { secret: "test-secret" }
    );
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-tenant-id": "other-tenant"
      }
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: { code: "TENANT_ACCESS_DENIED", message: "Cross-tenant access denied." }
    });
  });
});
