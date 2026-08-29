import assert from "node:assert/strict";
import test from "node:test";
import { createAccessToken, verifyAccessToken } from "../src/security/auth.js";

test("creates and verifies a tenant-scoped access token", () => {
  const token = createAccessToken(
    { sub: "user-1", tenantId: "park-1", role: "member" },
    { secret: "test-secret", now: 1_700_000_000 }
  );
  assert.deepEqual(
    verifyAccessToken(token, { secret: "test-secret", now: 1_700_000_010 }),
    { sub: "user-1", tenantId: "park-1", role: "member", iat: 1_700_000_000, exp: 1_700_003_600 }
  );
});

test("rejects a token signed with another secret", () => {
  const token = createAccessToken({ sub: "user-1", tenantId: "park-1" }, { secret: "one" });
  assert.throws(() => verifyAccessToken(token, { secret: "two" }), /Invalid access token/);
});

test("rejects expired tokens", () => {
  const token = createAccessToken(
    { sub: "user-1", tenantId: "park-1" },
    { secret: "test-secret", now: 100, ttlSeconds: 10 }
  );
  assert.throws(() => verifyAccessToken(token, { secret: "test-secret", now: 111 }), /expired/);
});
