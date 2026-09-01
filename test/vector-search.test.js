import assert from "node:assert/strict";
import test from "node:test";
import { OpenSearchVectorIndex } from "../src/search/opensearch-vector-index.js";

test("indexes listings and executes a tenant-safe vector search", async () => {
  const calls = [];
  const client = {
    async indices() {},
    async index(params) { calls.push({ action: "index", params }); },
    async search(params) {
      calls.push({ action: "search", params });
      return { hits: { hits: [{ _source: { id: "offer-1", tenantId: "startup-1" }, _score: 0.93 }] } };
    }
  };
  const index = new OpenSearchVectorIndex({ client, indexName: "marketplace-vectors" });
  await index.indexListing({
    id: "offer-1", tenantId: "startup-1", type: "tech_offer",
    title: "SEM lab", summary: "Materials microscopy", embedding: [0.1, 0.2]
  });
  const results = await index.search({ tenantId: "park-1", embedding: [0.1, 0.2], k: 5 });
  assert.equal(results[0].id, "offer-1");
  assert.equal(results[0].score, 0.93);
  assert.equal(calls[0].params.id, "startup-1/offer-1");
  assert.match(JSON.stringify(calls[1].params.body), /knn/);
  assert.deepEqual(calls[1].params.body.query.knn.embedding.filter.bool.filter, [
    { term: { tenantId: "park-1" } },
    { term: { status: "open" } }
  ]);
});
