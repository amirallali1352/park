const mapEscrow = (row) => ({
  id: row.id, tenantId: row.tenant_id, payerId: row.payer_id, payeeId: row.payee_id,
  currency: row.currency, amount: Number(row.amount), referenceId: row.reference_id,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

export class PostgresFinanceRepository {
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

  async save(escrow) {
    const result = await this.#withTenantContext(escrow.tenantId, (client) => client.query(
      "INSERT INTO escrow_transactions (id, tenant_id, payer_id, payee_id, currency, amount, reference_id, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id, id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at RETURNING *",
      [escrow.id, escrow.tenantId, escrow.payerId, escrow.payeeId, escrow.currency,
        escrow.amount, escrow.referenceId, escrow.status, escrow.createdAt, escrow.updatedAt]
    ));
    return mapEscrow(result.rows[0]);
  }

  async saveInTransaction(client, escrow) {
    const result = await client.query(
      "INSERT INTO escrow_transactions (id, tenant_id, payer_id, payee_id, currency, amount, reference_id, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id, id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at RETURNING *",
      [escrow.id, escrow.tenantId, escrow.payerId, escrow.payeeId, escrow.currency,
        escrow.amount, escrow.referenceId, escrow.status, escrow.createdAt, escrow.updatedAt]
    );
    return mapEscrow(result.rows[0]);
  }

  async find(tenantId, id) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM escrow_transactions WHERE tenant_id = $1 AND id = $2", [tenantId, id]
    ));
    return result.rows[0] ? mapEscrow(result.rows[0]) : null;
  }

  async list(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM escrow_transactions WHERE tenant_id = $1 ORDER BY created_at, id", [tenantId]
    ));
    return result.rows.map(mapEscrow);
  }
}
