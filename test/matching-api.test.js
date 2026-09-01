import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryMarketplaceRepository } from "../src/infrastructure/in-memory-marketplace-repository.js";

test("returns ranked semantic matches for a tenant request", async () => {
  const marketplaceRepository = new InMemoryMarketplaceRepository();
  await marketplaceRepository.save({
    id: "offer-1", tenantId: "startup-1", type: "tech_offer", title: "SEM Lab",
    summary: "Surface microscopy", capabilities: ["SEM"], tags: ["materials"],
    status: "open", version: 1, createdAt: new Date().toISOString()
  });
  const server = createApiServer(undefined, { marketplaceRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/marketplace/match`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        type: "tech_request", title: "SEM materials",
        summary: "Need microscopy", capabilities: ["SEM"], tags: ["materials"]
      })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json())[0].id, "offer-1");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
