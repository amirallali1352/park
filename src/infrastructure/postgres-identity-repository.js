import { assertTenantAccess } from "../domain/identity.js";

function mapTenant(row) {
  return { id: row.id, name: row.name, type: row.type };
}

function mapUser(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role
  };
}

export class PostgresIdentityRepository {
  #client;

  constructor(client) {
    if (!client || typeof client.query !== "function") {
      throw new TypeError("A PostgreSQL client with a query method is required.");
    }
    this.#client = client;
  }

  async saveTenant(tenant) {
    const result = await this.#client.query(
      "INSERT INTO tenants (id, name, type) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type RETURNING id, name, type",
      [tenant.id, tenant.name, tenant.type]
    );
    return mapTenant(result.rows[0]);
  }

  async saveUser(user) {
    const result = await this.#client.query(
      "INSERT INTO users (id, tenant_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role RETURNING id, tenant_id, email, role",
      [user.id, user.tenantId, user.email, user.role]
    );
    return mapUser(result.rows[0]);
  }

  async listUsers(user, tenantId = user?.tenantId) {
    assertTenantAccess(user, tenantId);
    await this.#client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await this.#client.query(
      "SELECT id, tenant_id, email, role FROM users ORDER BY id",
      [tenantId]
    );
    return result.rows.map(mapUser);
  }
}
