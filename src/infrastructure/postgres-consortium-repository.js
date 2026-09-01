const parseJson = (value) => typeof value === "string" ? JSON.parse(value) : value;
const mapConsortium = (row) => ({
  id: row.id, tenantId: row.tenant_id, requestId: row.request_id,
  grantProgram: row.grant_program, members: parseJson(row.members),
  status: row.status, createdAt: new Date(row.created_at).toISOString()
});

export class PostgresConsortiumRepository {
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

  async save(consortium) {
    const result = await this.#withTenantContext(consortium.tenantId, (client) => client.query(
      "INSERT INTO consortia (id, tenant_id, request_id, grant_program, members, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id, id) DO UPDATE SET members = EXCLUDED.members, status = EXCLUDED.status RETURNING *",
      [consortium.id, consortium.tenantId, consortium.requestId, consortium.grantProgram,
        JSON.stringify(consortium.members), consortium.status, consortium.createdAt]
    ));
    return mapConsortium(result.rows[0]);
  }

  async list(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM consortia WHERE tenant_id = $1 ORDER BY created_at, id", [tenantId]
    ));
    return result.rows.map(mapConsortium);
  }
}
