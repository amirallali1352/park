const parseJson = (value) => typeof value === "string" ? JSON.parse(value) : value;
const mapListing = (row) => ({
  id: row.id, tenantId: row.tenant_id, type: row.type, title: row.title,
  summary: row.summary, capabilities: parseJson(row.capabilities),
  tags: parseJson(row.tags), status: row.status, version: row.version,
  createdAt: new Date(row.created_at).toISOString()
});

export class PostgresMarketplaceRepository {
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

  async save(listing) {
    const result = await this.#withTenantContext(listing.tenantId, (client) => client.query(
      "INSERT INTO marketplace_listings (id, tenant_id, type, title, summary, capabilities, tags, status, version, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id, id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, capabilities = EXCLUDED.capabilities, tags = EXCLUDED.tags, status = EXCLUDED.status, version = EXCLUDED.version, updated_at = now() RETURNING *",
      [listing.id, listing.tenantId, listing.type, listing.title, listing.summary,
        JSON.stringify(listing.capabilities), JSON.stringify(listing.tags), listing.status,
        listing.version, listing.createdAt]
    ));
    return mapListing(result.rows[0]);
  }

  async find(tenantId, id) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM marketplace_listings WHERE tenant_id = $1 AND id = $2", [tenantId, id]
    ));
    return result.rows[0] ? mapListing(result.rows[0]) : null;
  }

  async list(tenantId, { type, tag, status = "open" } = {}) {
    const values = [tenantId];
    const filters = ["tenant_id = $1"];
    if (type) { values.push(type); filters.push(`type = $${values.length}`); }
    if (status) { values.push(status); filters.push(`status = $${values.length}`); }
    if (tag) { values.push(JSON.stringify([tag])); filters.push(`tags @> $${values.length}::jsonb`); }
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      `SELECT * FROM marketplace_listings WHERE ${filters.join(" AND ")} ORDER BY created_at, id`, values
    ));
    return result.rows.map(mapListing);
  }
}
