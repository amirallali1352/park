const mapVoucher = (row) => ({
  id: row.id, tenantId: row.tenant_id, beneficiaryId: row.beneficiary_id,
  program: row.program, currency: row.currency, amount: Number(row.amount),
  redeemedAmount: Number(row.redeemed_amount), status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

export class PostgresVoucherRepository {
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

  async save(voucher) {
    const result = await this.#withTenantContext(voucher.tenantId, (client) => client.query(
      "INSERT INTO vouchers (id, tenant_id, beneficiary_id, program, currency, amount, redeemed_amount, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id, id) DO UPDATE SET redeemed_amount = EXCLUDED.redeemed_amount, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at RETURNING *",
      [voucher.id, voucher.tenantId, voucher.beneficiaryId, voucher.program, voucher.currency,
        voucher.amount, voucher.redeemedAmount, voucher.status, voucher.createdAt, voucher.updatedAt]
    ));
    return mapVoucher(result.rows[0]);
  }

  async find(tenantId, id) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM vouchers WHERE tenant_id = $1 AND id = $2", [tenantId, id]
    ));
    return result.rows[0] ? mapVoucher(result.rows[0]) : null;
  }

  async list(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM vouchers WHERE tenant_id = $1 ORDER BY created_at, id", [tenantId]
    ));
    return result.rows.map(mapVoucher);
  }
}
