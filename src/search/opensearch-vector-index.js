export class OpenSearchVectorIndex {
  constructor({ client, indexName = "marketplace-vectors" } = {}) {
    if (!client || typeof client.index !== "function" || typeof client.search !== "function") {
      throw new TypeError("An OpenSearch client with index and search methods is required.");
    }
    this.client = client;
    this.indexName = indexName;
  }

  async indexListing(listing) {
    await this.client.index({
      index: this.indexName,
      id: `${listing.tenantId}/${listing.id}`,
      body: {
        id: listing.id,
        tenantId: listing.tenantId,
        type: listing.type,
        title: listing.title,
        summary: listing.summary,
        capabilities: listing.capabilities,
        tags: listing.tags,
        status: listing.status,
        embedding: listing.embedding
      },
      refresh: "wait_for"
    });
  }

  async search({ tenantId, embedding, k = 10 } = {}) {
    const result = await this.client.search({
      index: this.indexName,
      body: {
        size: k,
        query: {
          knn: {
            embedding: {
              vector: embedding,
              k,
              filter: {
                bool: {
                  filter: [
                    { term: { tenantId } },
                    { term: { status: "open" } }
                  ]
                }
              }
            }
          }
        }
      }
    });
    const response = result.body ?? result;
    return (response.hits?.hits ?? []).map((hit) => ({
      ...hit._source,
      score: hit._score,
      reasons: ["vector"]
    }));
  }
}
