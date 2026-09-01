import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { createUser } from "../src/domain/identity.js";
import { InMemoryAuditRepository } from "../src/infrastructure/in-memory-audit-repository.js";
import { InMemoryIdentityRepository } from "../src/infrastructure/in-memory-identity-repository.js";
import { hashPassword } from "../src/security/password.js";

test("records successful and failed login attempts in the audit chain", async () => {
  const repository = new InMemoryIdentityRepository();
  const auditRepository = new InMemoryAuditRepository();
  await repository.saveTenant({ id: "park-1", name: "Park", type: "park" });
  await repository.saveUser({
    ...createUser({ id: "admin-1", tenantId: "park-1", email: "admin@park.local", role: "park_admin" }),
    passwordHash: await hashPassword("Admin-pass-123!")
  });
  const server = createApiServer(repository, { authSecret: "test-secret", auditRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "park-1", email: "ADMIN@PARK.LOCAL", password: "Admin-pass-123!"
      })
    });
    await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "park-1", email: "admin@park.local", password: "wrong-password"
      })
    });
    const events = await auditRepository.list("park-1");
    assert.deepEqual(events.map((event) => event.action), [
      "auth.login.succeeded", "auth.login.failed"
    ]);
    assert.equal(events[0].payload.email, "admin@park.local");
    assert.equal(events[1].payload.email, "admin@park.local");
    assert.equal("password" in events[0].payload, false);
    assert.equal("password" in events[1].payload, false);
    assert.equal(events[1].actorId, "admin@park.local");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
