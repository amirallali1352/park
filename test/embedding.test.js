import assert from "node:assert/strict";
import test from "node:test";
import { LocalEmbeddingProvider, cosineSimilarity } from "../src/search/embedding.js";

test("creates deterministic normalized embeddings", async () => {
  const provider = new LocalEmbeddingProvider({ dimensions: 64 });
  const first = await provider.embed("SEM materials microscopy");
  const second = await provider.embed("SEM materials microscopy");
  assert.deepEqual(first, second);
  assert.equal(first.length, 64);
  assert.ok(Math.abs(Math.hypot(...first) - 1) < 0.000001);
});

test("computes cosine similarity for compatible vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.throws(() => cosineSimilarity([1], [1, 0]), { code: "INVALID_VECTOR" });
});
