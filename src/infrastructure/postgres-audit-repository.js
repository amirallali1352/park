const mapEvent = (row) => ({
  id: row.id, tenantId: row.tenant_id, actorId: row.actor_id, action: row.action,
  resourceType: row.resource_type, resourceId: row.resource_id, payload: row.payload,
  occurredAt: new Date(row.occurred_at).toISOString(),
  previousHash: row.previous_hash, hash: row.event_hash
});

export class PostgresAuditRepository {
  #client;
  constructor(client) {
    if (!client || typeof client.query !== "function") throw new TypeError("A PostgreSQL client with a query method is required.");
    this.#client = client;
  }

  async append(event) {
    const result = await this.#withTenantContext(event.tenantId, (client) => client.query(
      "INSERT INTO audit_events (id, tenant_id, actor_id, action, resource_type, resource_id, payload, occurred_at, previous_hash, event_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [event.id, event.tenantId, event.actorId, event.action, event.resourceType,
        event.resourceId, JSON.stringify(event.payload), event.occurredAt, event.previousHash, event.hash]
    ));
    return mapEvent(result.rows[0]);
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

  async list(tenantId) {
    await this.#client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await this.#client.query(
      "SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY occurred_at, id", [tenantId]
    );
    return result.rows.map(mapEvent);
  }
}
