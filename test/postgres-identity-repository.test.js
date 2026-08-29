import assert from "node:assert/strict";
import test from "node:test";
import { TenantType, UserRole, createTenant, createUser } from "../src/domain/identity.js";
import { PostgresIdentityRepository } from "../src/infrastructure/postgres-identity-repository.js";

function mockClient() {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO tenants")) return { rows: [{ id: values[0], name: values[1], type: values[2] }] };
      if (text.includes("INSERT INTO users")) return { rows: [{ id: values[0], tenant_id: values[1], email: values[2], role: values[3] }] };
      if (text.includes("SELECT id, tenant_id, email, role")) {
        return { rows: [{ id: "u1", tenant_id: "park-1", email: "u@test.local", role: "member" }] };
      }
      return { rows: [] };
    }
  };
}

test("persists tenants with parameterized SQL", async () => {
  const client = mockClient();
  const repository = new PostgresIdentityRepository(client);
  const tenant = createTenant({ id: "park-1", name: "Park", type: TenantType.PARK });

  const result = await repository.saveTenant(tenant);

  assert.deepEqual(result, tenant);
  assert.deepEqual(client.calls[0], {
    text: "INSERT INTO tenants (id, name, type) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type RETURNING id, name, type",
    values: ["park-1", "Park", "park"]
  });
});

test("persists users with a tenant boundary", async () => {
  const client = mockClient();
  const repository = new PostgresIdentityRepository(client);
  const user = createUser({ id: "u1", tenantId: "park-1", email: "u@test.local", role: UserRole.MEMBER });

  const result = await repository.saveUser(user);

  assert.deepEqual(result, user);
  assert.equal(client.calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.deepEqual(client.calls[0].values, ["park-1"]);
  assert.match(client.calls[1].text, /INSERT INTO users \(id, tenant_id, email, role\)/);
  assert.deepEqual(client.calls[1].values, ["u1", "park-1", "u@test.local", "member"]);
});

test("sets the database tenant context before reading users", async () => {
  const client = mockClient();
  const repository = new PostgresIdentityRepository(client);

  const users = await repository.listUsers({ tenantId: "park-1" }, "park-1");

  assert.deepEqual(users, [{ id: "u1", tenantId: "park-1", email: "u@test.local", role: "member" }]);
  assert.equal(client.calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.deepEqual(client.calls[0].values, ["park-1"]);
  assert.match(client.calls[1].text, /SELECT id, tenant_id, email, role FROM users WHERE tenant_id = \$1/);
  assert.deepEqual(client.calls[1].values, ["park-1"]);
});
