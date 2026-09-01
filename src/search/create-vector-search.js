import { Client } from "@opensearch-project/opensearch";
import { OpenSearchVectorIndex } from "./opensearch-vector-index.js";

export function createVectorSearch({
  node = process.env.OPENSEARCH_NODE,
  indexName = process.env.OPENSEARCH_INDEX ?? "marketplace-vectors"
} = {}) {
  if (!node) throw new Error("OPENSEARCH_NODE is required.");
  return new OpenSearchVectorIndex({
    client: new Client({ node }),
    indexName
  });
}
