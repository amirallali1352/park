import pg from "pg";
import { PostgresIdentityRepository } from "./postgres-identity-repository.js";
import { PostgresFacilityRepository } from "./postgres-facility-repository.js";
import { PostgresSampleRepository } from "./postgres-sample-repository.js";
import { createPostgresPool } from "./postgres-client.js";

export function createProductionRepository({
  databaseUrl = process.env.DATABASE_URL,
  Pool = pg.Pool
} = {}) {
  const pool = createPostgresPool({ Pool, connectionString: databaseUrl });
  return {
    identity: new PostgresIdentityRepository(pool),
    facility: new PostgresFacilityRepository(pool),
    samples: new PostgresSampleRepository(pool)
  };
}
