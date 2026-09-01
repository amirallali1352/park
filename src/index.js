import { createApiServer } from "./api/server.js";
import { createProductionRepository } from "./infrastructure/production-repository.js";
import { createObjectStorage } from "./infrastructure/create-object-storage.js";
import { EncryptedFileService } from "./security/encrypted-file-service.js";
import { EnvelopeEncryption } from "./security/encryption.js";

const port = Number(process.env.PORT ?? 3000);
const authRequired = process.env.AUTH_REQUIRED === "true";
const repositories = process.env.DATABASE_URL
  ? createProductionRepository()
  : undefined;
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
  fileService,
  requireLegalWrapper: process.env.REQUIRE_LEGAL_WRAPPER === "true",
  encryptionKek: process.env.ENCRYPTION_KEK
});
server.listen(port, "0.0.0.0", () => {
  console.log(
    `STP OS API listening on port ${port} (${repositories ? "postgres" : "memory"} repository, auth ${authRequired ? "required" : "optional"})`
  );
});
