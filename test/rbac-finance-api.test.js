import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { createAccessToken } from "../src/security/auth.js";

async function startServer() {
  const server = createApiServer(undefined, {
    authRequired: true,
    authSecret: "test-secret"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

test("denies a member from creating an escrow", async () => {
  const server = await startServer();
  const token = createAccessToken(
    { sub: "member-1", tenantId: "park-1", role: "member" },
    { secret: "test-secret" }
  );
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/finance/escrows`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "escrow-rbac-1", payerId: "startup-1", payeeId: "lab-1",
        currency: "TRY", amount: 1000, referenceId: "ref-1"
      })
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: { code: "FORBIDDEN", message: "Role is not allowed for this operation." }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("allows a tenant administrator to create an escrow", async () => {
  const server = await startServer();
  const token = createAccessToken(
    { sub: "admin-1", tenantId: "park-1", role: "tenant_admin" },
    { secret: "test-secret" }
  );
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/finance/escrows`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: "escrow-rbac-2", payerId: "startup-1", payeeId: "lab-1",
        currency: "TRY", amount: 1000, referenceId: "ref-2"
      })
    });
    assert.equal(response.status, 201);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
