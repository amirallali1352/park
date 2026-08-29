import assert from "node:assert/strict";
import test from "node:test";
import { TenantType, createTenant, createUser } from "../src/domain/identity.js";
import { InMemoryIdentityRepository } from "../src/infrastructure/in-memory-identity-repository.js";

test("lists only users belonging to the requested tenant", () => {
  const repository = new InMemoryIdentityRepository();
  const park = createTenant({ id: "park-1", name: "Park", type: TenantType.PARK });
  const startup = createTenant({ id: "startup-1", name: "Startup", type: TenantType.STARTUP });
  repository.saveTenant(park);
  repository.saveTenant(startup);
  const parkAdmin = createUser({ id: "admin", tenantId: park.id, email: "admin@park.test" });
  repository.saveUser(parkAdmin);
  repository.saveUser(createUser({ id: "s1", tenantId: startup.id, email: "s@startup.test" }));

  assert.deepEqual(repository.listUsers(parkAdmin, park.id).map((user) => user.id), ["admin"]);
});

test("prevents a user from reading another tenant", () => {
  const repository = new InMemoryIdentityRepository();
  repository.saveTenant(createTenant({ id: "park-1", name: "Park", type: TenantType.PARK }));
  const user = createUser({ id: "u", tenantId: "park-1", email: "u@park.test" });
  repository.saveUser(user);

  assert.throws(() => repository.listUsers(user, "other-tenant"), { code: "TENANT_ACCESS_DENIED" });
});
