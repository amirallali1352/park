export function createPostgresPool({ Pool, connectionString, max = 10 }) {
  if (!Pool || typeof Pool !== "function") {
    throw new TypeError("A PostgreSQL Pool constructor is required.");
  }
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }
  return new Pool({ connectionString, max });
}

export async function runMigrations(pool, migrations) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("A PostgreSQL pool is required.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const migration of migrations) {
      await client.query(migration.sql);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
