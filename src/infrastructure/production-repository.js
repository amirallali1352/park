import pg from "pg";
import { PostgresIdentityRepository } from "./postgres-identity-repository.js";
import { PostgresFacilityRepository } from "./postgres-facility-repository.js";
import { PostgresSampleRepository } from "./postgres-sample-repository.js";
import { PostgresOutboxRepository } from "./postgres-outbox-repository.js";
import { PostgresAuditRepository } from "./postgres-audit-repository.js";
import { PostgresFileMetadataRepository } from "./postgres-file-metadata-repository.js";
import { PostgresLegalRepository } from "./postgres-legal-repository.js";
import { PostgresMarketplaceRepository } from "./postgres-marketplace-repository.js";
import { PostgresConsortiumRepository } from "./postgres-consortium-repository.js";
import { PostgresFinanceRepository } from "./postgres-finance-repository.js";
import { PostgresVoucherRepository } from "./postgres-voucher-repository.js";
import { PostgresCertificationRepository } from "./postgres-certification-repository.js";
import { PostgresBillingRepository } from "./postgres-billing-repository.js";
import { createPostgresPool } from "./postgres-client.js";
import { PostgresUnitOfWork } from "./postgres-unit-of-work.js";

export function createProductionRepository({
  databaseUrl = process.env.DATABASE_URL,
  Pool = pg.Pool
} = {}) {
  const pool = createPostgresPool({ Pool, connectionString: databaseUrl });
  return {
    pool,
    unitOfWork: new PostgresUnitOfWork(pool),
    identity: new PostgresIdentityRepository(pool),
    facility: new PostgresFacilityRepository(pool),
    samples: new PostgresSampleRepository(pool),
    outbox: new PostgresOutboxRepository(pool),
    audit: new PostgresAuditRepository(pool),
    fileMetadata: new PostgresFileMetadataRepository(pool),
    legal: new PostgresLegalRepository(pool),
    marketplace: new PostgresMarketplaceRepository(pool),
    consortium: new PostgresConsortiumRepository(pool),
    finance: new PostgresFinanceRepository(pool),
    voucher: new PostgresVoucherRepository(pool),
    certification: new PostgresCertificationRepository(pool),
    billing: new PostgresBillingRepository(pool)
  };
}
