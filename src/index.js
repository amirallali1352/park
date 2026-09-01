import { createApiServer } from "./api/server.js";
import { createProductionRepository } from "./infrastructure/production-repository.js";

const port = Number(process.env.PORT ?? 3000);
const authRequired = process.env.AUTH_REQUIRED === "true";
const repositories = process.env.DATABASE_URL
  ? createProductionRepository()
  : undefined;
const server = createApiServer(repositories?.identity, {
  authRequired,
  authSecret: process.env.AUTH_SECRET,
  authIssuer: process.env.AUTH_ISSUER,
  authAudience: process.env.AUTH_AUDIENCE,
  facilityRepository: repositories?.facility,
  sampleRepository: repositories?.samples,
  outboxRepository: repositories?.outbox,
  auditRepository: repositories?.audit
});
server.listen(port, "0.0.0.0", () => {
  console.log(
    `STP OS API listening on port ${port} (${repositories ? "postgres" : "memory"} repository, auth ${authRequired ? "required" : "optional"})`
  );
});
