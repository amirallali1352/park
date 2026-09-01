const mapFile = (row) => ({
  objectId: row.object_id,
  tenantId: row.tenant_id,
  bucket: row.bucket,
  storageKey: row.storage_key,
  contentType: row.content_type,
  size: Number(row.size_bytes),
  envelopeVersion: row.envelope_version
});

export class PostgresFileMetadataRepository {
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

  async save(metadata) {
    const result = await this.#withTenantContext(metadata.tenantId, (client) => client.query(
      "INSERT INTO file_metadata (object_id, tenant_id, bucket, storage_key, content_type, size_bytes, envelope_version) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id, object_id) DO UPDATE SET bucket = EXCLUDED.bucket, storage_key = EXCLUDED.storage_key, content_type = EXCLUDED.content_type, size_bytes = EXCLUDED.size_bytes, envelope_version = EXCLUDED.envelope_version, updated_at = now() RETURNING object_id, tenant_id, bucket, storage_key, content_type, size_bytes, envelope_version",
      [metadata.objectId, metadata.tenantId, metadata.bucket, metadata.storageKey,
        metadata.contentType, metadata.size, metadata.envelopeVersion]
    ));
    return mapFile(result.rows[0]);
  }

  async find(tenantId, objectId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT object_id, tenant_id, bucket, storage_key, content_type, size_bytes, envelope_version FROM file_metadata WHERE tenant_id = $1 AND object_id = $2",
      [tenantId, objectId]
    ));
    return result.rows[0] ? mapFile(result.rows[0]) : null;
  }

  async remove(tenantId, objectId) {
    await this.#withTenantContext(tenantId, (client) => client.query(
      "DELETE FROM file_metadata WHERE tenant_id = $1 AND object_id = $2", [tenantId, objectId]
    ));
  }
}
