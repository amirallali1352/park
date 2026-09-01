import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryMarketplaceRepository } from "../src/infrastructure/in-memory-marketplace-repository.js";

test("creates, searches, and closes a marketplace listing", async () => {
  const marketplaceRepository = new InMemoryMarketplaceRepository();
  const server = createApiServer(undefined, { marketplaceRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "startup-1" };
  try {
    let response = await fetch(`${base}/api/v1/marketplace/listings`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "request-1", type: "tech_request",
        title: "Need SEM characterization",
        summary: "Looking for a certified lab partner",
        capabilities: ["SEM"], tags: ["materials"]
      })
    });
    assert.equal(response.status, 201);

    response = await fetch(`${base}/api/v1/marketplace/listings?type=tech_request&tag=materials`, {
      headers: { "x-tenant-id": "startup-1" }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).length, 1);

    response = await fetch(`${base}/api/v1/marketplace/listings/request-1/close`, {
      method: "POST", headers
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "closed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("does not expose another tenant's listings", async () => {
  const repository = new InMemoryMarketplaceRepository();
  await repository.save({
    id: "private-1", tenantId: "startup-1", type: "business_offer",
    title: "Private", summary: "Private listing", capabilities: [], tags: [],
    status: "open", version: 1, createdAt: new Date().toISOString()
  });
  const server = createApiServer(undefined, { marketplaceRepository: repository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/marketplace/listings`, {
      headers: { "x-tenant-id": "startup-2" }
    });
    assert.deepEqual(await response.json(), []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
