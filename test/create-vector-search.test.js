import assert from "node:assert/strict";
import test from "node:test";
import { createVectorSearch } from "../src/search/create-vector-search.js";

test("creates an OpenSearch vector index from configuration", () => {
  const index = createVectorSearch({
    node: "http://127.0.0.1:9200",
    indexName: "test-vectors"
  });
  assert.equal(index.indexName, "test-vectors");
  assert.equal(typeof index.search, "function");
});

test("requires an OpenSearch node", () => {
  assert.throws(() => createVectorSearch({}), /OPENSEARCH_NODE/);
});
