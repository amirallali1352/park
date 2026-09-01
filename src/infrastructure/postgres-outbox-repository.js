const mapEvent = (row) => ({
  id: row.id, tenantId: row.tenant_id, type: row.event_type,
  version: row.version, aggregateId: row.aggregate_id, payload: row.payload,
  occurredAt: new Date(row.occurred_at).toISOString(), status: row.status,
  ...(row.published_at ? { publishedAt: new Date(row.published_at).toISOString() } : {})
});

export class PostgresOutboxRepository {
  #client;
  constructor(client) {
    if (!client || typeof client.query !== "function") {
      throw new TypeError("A PostgreSQL client with a query method is required.");
    }
    this.#client = client;
  }

  async save(event) {
    const result = await this.#withTenantContext(event.tenantId, (client) => client.query(
      "INSERT INTO outbox_events (id, tenant_id, event_type, version, aggregate_id, payload, occurred_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, tenant_id, event_type, version, aggregate_id, payload, occurred_at, status, published_at",
      [event.id, event.tenantId, event.type, event.version, event.aggregateId,
        JSON.stringify(event.payload), event.occurredAt, event.status]
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

  async listPending(limit = 100) {
    const result = await this.#client.query(
      "SELECT id, tenant_id, event_type, version, aggregate_id, payload, occurred_at, status, published_at FROM outbox_events WHERE status = 'pending' ORDER BY occurred_at, id LIMIT $1",
      [limit]
    );
    return result.rows.map(mapEvent);
  }

  async markPublished(id, publishedAt = new Date().toISOString()) {
    const result = await this.#client.query(
      "UPDATE outbox_events SET status = 'published', published_at = $2 WHERE id = $1 RETURNING id, tenant_id, event_type, version, aggregate_id, payload, occurred_at, status, published_at",
      [id, publishedAt]
    );
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }
}
