import { SampleError } from "../domain/sample.js";

const mapSample = (row) => ({
  id: row.id, tenantId: row.tenant_id, name: row.name,
  barcode: row.barcode, submittedBy: row.submitted_by, status: row.status
});

const mapEvent = (row) => ({
  id: row.id, sampleId: row.sample_id, tenantId: row.tenant_id,
  actorId: row.actor_id, action: row.action, location: row.location,
  occurredAt: new Date(row.occurred_at).toISOString()
});

export class PostgresSampleRepository {
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

  async saveSample(sample) {
    try {
      const result = await this.#withTenantContext(sample.tenantId, (client) => client.query(
        "INSERT INTO samples (id, tenant_id, name, barcode, submitted_by, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, barcode = EXCLUDED.barcode, status = EXCLUDED.status RETURNING id, tenant_id, name, barcode, submitted_by, status",
        [sample.id, sample.tenantId, sample.name, sample.barcode, sample.submittedBy, sample.status]
      ));
      return mapSample(result.rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        throw new SampleError("Barcode is already used in this tenant.", "DUPLICATE_BARCODE");
      }
      throw error;
    }
  }

  async listSamples(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT id, tenant_id, name, barcode, submitted_by, status FROM samples ORDER BY id"
    ));
    return result.rows.map(mapSample);
  }

  async saveCustodyEvent(event) {
    return this.saveCustodyEventInTransaction(this.#client, event, true);
  }

  async saveCustodyEventInTransaction(client, event, useTenantContext = false) {
    const run = (txClient) => txClient.query(
      "INSERT INTO sample_custody_events (id, sample_id, tenant_id, actor_id, action, location, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, sample_id, tenant_id, actor_id, action, location, occurred_at",
      [event.id, event.sampleId, event.tenantId, event.actorId, event.action, event.location, event.occurredAt]
    );
    const result = useTenantContext
      ? await this.#withTenantContext(event.tenantId, run)
      : await run(client);
    return mapEvent(result.rows[0]);
  }

  async listCustodyEvents(tenantId, sampleId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT id, sample_id, tenant_id, actor_id, action, location, occurred_at FROM sample_custody_events WHERE sample_id = $1 ORDER BY occurred_at, id",
      [sampleId]
    ));
    return result.rows.map(mapEvent);
  }
}
