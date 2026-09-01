const parseJson = (value) => typeof value === "string" ? JSON.parse(value) : value;
const mapContract = (row) => ({
  id: row.id, tenantId: row.tenant_id, type: row.type, title: row.title,
  parties: parseJson(row.parties), terms: parseJson(row.terms), version: row.version, status: row.status,
  signatures: parseJson(row.signatures), document: row.document,
  createdAt: new Date(row.created_at).toISOString()
});

export class PostgresLegalRepository {
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

  async save(contract) {
    const result = await this.#withTenantContext(contract.tenantId, (client) => client.query(
      "INSERT INTO legal_contracts (id, tenant_id, type, title, parties, terms, version, status, signatures, document, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (tenant_id, id) DO UPDATE SET title = EXCLUDED.title, parties = EXCLUDED.parties, terms = EXCLUDED.terms, version = EXCLUDED.version, status = EXCLUDED.status, signatures = EXCLUDED.signatures, document = EXCLUDED.document, updated_at = now() RETURNING *",
      [contract.id, contract.tenantId, contract.type, contract.title, JSON.stringify(contract.parties),
        JSON.stringify(contract.terms), contract.version, contract.status, JSON.stringify(contract.signatures),
        contract.document, contract.createdAt]
    ));
    return mapContract(result.rows[0]);
  }

  async find(tenantId, id) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM legal_contracts WHERE tenant_id = $1 AND id = $2", [tenantId, id]
    ));
    return result.rows[0] ? mapContract(result.rows[0]) : null;
  }

  async list(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM legal_contracts WHERE tenant_id = $1 ORDER BY created_at, id", [tenantId]
    ));
    return result.rows.map(mapContract);
  }

  async hasActiveAgreement(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT 1 FROM legal_contracts WHERE tenant_id = $1 AND status = 'active' LIMIT 1", [tenantId]
    ));
    return result.rows.length > 0;
  }
}
