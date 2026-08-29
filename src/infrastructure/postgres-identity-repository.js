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
    if (!client || (typeof client.query !== "function" && typeof client.connect !== "function")) {
      throw new TypeError("A PostgreSQL client with a query method is required.");
    }
    this.#client = client;
  }

  async #withTenantContext(tenantId, work) {
    if (typeof this.#client.connect !== "function") {
      await this.#client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      return work(this.#client);
    }

    const client = await this.#client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTenant(tenant) {
    const result = await this.#client.query(
      "INSERT INTO tenants (id, name, type) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type RETURNING id, name, type",
      [tenant.id, tenant.name, tenant.type]
    );
    return mapTenant(result.rows[0]);
  }

  async saveUser(user) {
    const result = await this.#withTenantContext(user.tenantId, (client) => client.query(
        "INSERT INTO users (id, tenant_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role RETURNING id, tenant_id, email, role",
        [user.id, user.tenantId, user.email, user.role]
      ));
    return mapUser(result.rows[0]);
  }

  async listUsers(user, tenantId = user?.tenantId) {
    assertTenantAccess(user, tenantId);
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
        "SELECT id, tenant_id, email, role FROM users WHERE tenant_id = $1 ORDER BY id",
        [tenantId]
      ));
    return result.rows.map(mapUser);
  }
}
