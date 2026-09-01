import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { createUser } from "../src/domain/identity.js";
import { InMemoryIdentityRepository } from "../src/infrastructure/in-memory-identity-repository.js";
import { hashPassword } from "../src/security/password.js";

test("limits repeated failed login attempts per tenant and email", async () => {
  const repository = new InMemoryIdentityRepository();
  await repository.saveTenant({ id: "park-1", name: "Park", type: "park" });
  await repository.saveUser({
    ...createUser({ id: "user-1", tenantId: "park-1", email: "user@park.local" }),
    passwordHash: await hashPassword("Correct-pass-123!")
  });
  const server = createApiServer(repository, {
    authSecret: "test-secret",
    loginRateLimit: { maxAttempts: 2, windowMs: 60_000 }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = () => fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantId: "park-1", email: "user@park.local", password: "wrong-password"
    })
  });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request()).status, 401);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.deepEqual(await limited.json(), {
      error: { code: "LOGIN_RATE_LIMITED", message: "Too many login attempts. Try again later." }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
