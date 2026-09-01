const mapCertification = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  equipmentId: row.equipment_id,
  userId: row.user_id,
  expiresAt: new Date(row.expires_at).toISOString(),
  createdAt: new Date(row.created_at).toISOString()
});

export class PostgresCertificationRepository {
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

  async save(certification) {
    const result = await this.#withTenantContext(certification.tenantId, (client) => client.query(
      "INSERT INTO equipment_certifications (id, tenant_id, equipment_id, user_id, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, id) DO UPDATE SET expires_at = EXCLUDED.expires_at RETURNING *",
      [certification.id, certification.tenantId, certification.equipmentId, certification.userId,
        certification.expiresAt, certification.createdAt]
    ));
    return mapCertification(result.rows[0]);
  }

  async findValid(tenantId, equipmentId, userId, at = new Date()) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM equipment_certifications WHERE tenant_id = $1 AND equipment_id = $2 AND user_id = $3 AND expires_at > $4 ORDER BY expires_at DESC LIMIT 1",
      [tenantId, equipmentId, userId, new Date(at).toISOString()]
    ));
    return result.rows[0] ? mapCertification(result.rows[0]) : null;
  }

  async list(tenantId, equipmentId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT * FROM equipment_certifications WHERE tenant_id = $1 AND equipment_id = $2 ORDER BY expires_at DESC",
      [tenantId, equipmentId]
    ));
    return result.rows.map(mapCertification);
  }
}
