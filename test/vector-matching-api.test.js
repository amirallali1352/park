import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryMarketplaceRepository } from "../src/infrastructure/in-memory-marketplace-repository.js";
import { LocalEmbeddingProvider } from "../src/search/embedding.js";

test("uses vector search for semantic marketplace matching when configured", async () => {
  const marketplaceRepository = new InMemoryMarketplaceRepository();
  const embeddingProvider = new LocalEmbeddingProvider({ dimensions: 16 });
  const vectorIndex = {
    async search() {
      return [{ id: "vector-offer", tenantId: "startup-1", score: 0.88, reasons: ["vector"] }];
    }
  };
  const server = createApiServer(undefined, { marketplaceRepository, embeddingProvider, vectorIndex });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/marketplace/match`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ type: "tech_request", title: "SEM", summary: "materials", capabilities: ["SEM"] })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json())[0].id, "vector-offer");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
