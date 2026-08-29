import { createApiServer } from "./api/server.js";
import { createProductionRepository } from "./infrastructure/production-repository.js";

const port = Number(process.env.PORT ?? 3000);
const repository = process.env.DATABASE_URL
  ? createProductionRepository()
  : undefined;
const server = createApiServer(repository);
server.listen(port, "0.0.0.0", () => {
  console.log(`STP OS API listening on port ${port} (${repository ? "postgres" : "memory"} repository)`);
});
