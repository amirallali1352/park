import { createApiServer } from "./api/server.js";
import { createProductionRepository } from "./infrastructure/production-repository.js";
import { createObjectStorage } from "./infrastructure/create-object-storage.js";
import { EncryptedFileService } from "./security/encrypted-file-service.js";
import { EnvelopeEncryption } from "./security/encryption.js";
import { LocalEmbeddingProvider } from "./search/embedding.js";
import { createVectorSearch } from "./search/create-vector-search.js";
import { createClickHouseSink } from "./analytics/create-clickhouse-sink.js";
import { runMigrations } from "./infrastructure/postgres-client.js";
import { loadMigrations } from "./infrastructure/load-migrations.js";

const port = Number(process.env.PORT ?? 3000);
const authRequired = process.env.AUTH_REQUIRED === "true";
const repositories = process.env.DATABASE_URL
  ? createProductionRepository()
  : undefined;
if (repositories) {
  await runMigrations(repositories.pool, await loadMigrations());
}
const objectStorage = process.env.S3_ENDPOINT
  ? createObjectStorage()
  : undefined;
const fileService = objectStorage && process.env.ENCRYPTION_KEK
  ? new EncryptedFileService({
    encryption: new EnvelopeEncryption({ kek: process.env.ENCRYPTION_KEK }),
    storage: objectStorage,
    bucket: process.env.S3_BUCKET ?? "stp-encrypted-files",
    metadataRepository: repositories?.fileMetadata
  })
  : undefined;
const embeddingProvider = process.env.OPENSEARCH_NODE
  ? new LocalEmbeddingProvider({ dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 64) })
  : undefined;
const vectorIndex = process.env.OPENSEARCH_NODE
  ? createVectorSearch()
  : undefined;
const analyticsSink = process.env.CLICKHOUSE_URL
  ? createClickHouseSink()
  : undefined;
const server = createApiServer(repositories?.identity, {
  authRequired,
  authSecret: process.env.AUTH_SECRET,
  authIssuer: process.env.AUTH_ISSUER,
  authAudience: process.env.AUTH_AUDIENCE,
  facilityRepository: repositories?.facility,
  sampleRepository: repositories?.samples,
  outboxRepository: repositories?.outbox,
  auditRepository: repositories?.audit,
  legalRepository: repositories?.legal,
  marketplaceRepository: repositories?.marketplace,
  consortiumRepository: repositories?.consortium,
  financeRepository: repositories?.finance,
  voucherRepository: repositories?.voucher,
  certificationRepository: repositories?.certification,
  embeddingProvider,
  vectorIndex,
  analyticsSink,
  fileService,
  requireLegalWrapper: process.env.REQUIRE_LEGAL_WRAPPER === "true",
  encryptionKek: process.env.ENCRYPTION_KEK
});
server.listen(port, "0.0.0.0", () => {
  console.log(
    `STP OS API listening on port ${port} (${repositories ? "postgres" : "memory"} repository, auth ${authRequired ? "required" : "optional"})`
  );
});
