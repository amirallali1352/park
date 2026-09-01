export class PostgresUnitOfWork {
  #pool;

  constructor(pool) {
    if (!pool || typeof pool.connect !== "function") {
      throw new TypeError("A PostgreSQL pool is required.");
    }
    this.#pool = pool;
  }

  async run(tenantId, work) {
    if (!tenantId || typeof work !== "function") {
      throw new TypeError("Tenant id and transaction work are required.");
    }
    const client = await this.#pool.connect();
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
}
