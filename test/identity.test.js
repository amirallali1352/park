import assert from "node:assert/strict";
import test from "node:test";
import {
  IdentityError,
  TenantType,
  UserRole,
  assertTenantAccess,
  canAccessTenant,
  createTenant,
  createUser
} from "../src/domain/identity.js";

test("creates a valid park tenant", () => {
  const tenant = createTenant({ id: "park-1", name: "Tehran STP", type: TenantType.PARK });
  assert.deepEqual(tenant, { id: "park-1", name: "Tehran STP", type: "park" });
});

test("rejects an invalid tenant type", () => {
  assert.throws(
    () => createTenant({ id: "x", name: "Invalid", type: "company" }),
    (error) => error instanceof IdentityError && error.code === "INVALID_TENANT"
  );
});

test("normalizes user email and assigns a default member role", () => {
  const user = createUser({ id: "user-1", tenantId: "startup-1", email: "Founder@Example.COM" });
  assert.equal(user.email, "founder@example.com");
  assert.equal(user.role, UserRole.MEMBER);
});

test("allows access only inside the user's tenant boundary", () => {
  const user = createUser({ id: "user-1", tenantId: "startup-1", email: "a@example.com" });
  assert.equal(canAccessTenant(user, "startup-1"), true);
  assert.equal(canAccessTenant(user, "academic-1"), false);
  assert.throws(
    () => assertTenantAccess(user, "academic-1"),
    (error) => error.code === "TENANT_ACCESS_DENIED"
  );
});
