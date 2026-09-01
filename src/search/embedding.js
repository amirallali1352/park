import { createHash } from "node:crypto";

export class EmbeddingError extends Error {
  constructor(message, code = "EMBEDDING_ERROR") {
    super(message);
    this.name = "EmbeddingError";
    this.code = code;
  }
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) {
    throw new EmbeddingError("Vectors must have the same non-zero dimensions.", "INVALID_VECTOR");
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export class LocalEmbeddingProvider {
  constructor({ dimensions = 64 } = {}) {
    if (!Number.isInteger(dimensions) || dimensions < 2) {
      throw new EmbeddingError("Embedding dimensions must be at least 2.", "INVALID_DIMENSIONS");
    }
    this.dimensions = dimensions;
  }

  async embed(text) {
    if (typeof text !== "string" || !text.trim()) {
      throw new EmbeddingError("Text is required.", "INVALID_TEXT");
    }
    const vector = Array.from({ length: this.dimensions }, () => 0);
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
    for (const token of tokens) {
      const digest = createHash("sha256").update(token).digest();
      for (let offset = 0; offset < 4; offset += 1) {
        const bucket = digest.readUInt32BE(offset * 4) % this.dimensions;
        vector[bucket] += (digest[offset] % 2 === 0 ? 1 : -1) / (offset + 1);
      }
    }
    const norm = Math.hypot(...vector) || 1;
    return vector.map((value) => value / norm);
  }
}
