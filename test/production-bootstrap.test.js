import assert from "node:assert/strict";
import test from "node:test";
import { createProductionRepository } from "../src/infrastructure/production-repository.js";

test("creates a PostgreSQL-backed repository from DATABASE_URL", async () => {
  let poolOptions;
  class FakePool {
    constructor(options) {
      poolOptions = options;
    }
    query() {}
    connect() {}
  }

  const repository = await createProductionRepository({
    databaseUrl: "postgres://stp_os:change-me@localhost:5432/stp_os",
    Pool: FakePool
  });

  assert.equal(repository.identity.constructor.name, "PostgresIdentityRepository");
  assert.equal(repository.facility.constructor.name, "PostgresFacilityRepository");
  assert.deepEqual(poolOptions, {
    connectionString: "postgres://stp_os:change-me@localhost:5432/stp_os",
    max: 10
  });
});

test("fails fast when DATABASE_URL is missing", async () => {
  assert.throws(
    () => createProductionRepository({ Pool: class {} }),
    /DATABASE_URL is required/
  );
});
