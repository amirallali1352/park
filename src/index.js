import { createApiServer } from "./api/server.js";

const port = Number(process.env.PORT ?? 3000);
const server = createApiServer();
server.listen(port, "0.0.0.0", () => {
  console.log(`STP OS API listening on port ${port}`);
});
