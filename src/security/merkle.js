import { createHash } from "node:crypto";

const hashPair = (left, right) =>
  createHash("sha256").update(`${left}${right}`).digest("hex");

export function merkleRoot(leaves) {
  if (!Array.isArray(leaves) || leaves.length === 0) return null;
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      next.push(hashPair(level[index], level[index + 1] ?? level[index]));
    }
    level = next;
  }
  return level[0];
}

export function buildMerkleProof(leaves, index) {
  if (!Array.isArray(leaves) || index < 0 || index >= leaves.length) {
    throw new RangeError("Merkle proof index is out of range.");
  }
  const proof = [];
  let level = [...leaves];
  let current = index;
  while (level.length > 1) {
    const sibling = current % 2 === 0 ? current + 1 : current - 1;
    proof.push({
      hash: level[sibling] ?? level[current],
      position: current % 2 === 0 ? "right" : "left"
    });
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hashPair(level[i], level[i + 1] ?? level[i]));
    }
    current = Math.floor(current / 2);
    level = next;
  }
  return proof;
}

export function verifyMerkleProof(leaf, proof, root) {
  if (!leaf || !Array.isArray(proof) || !root) return false;
  let current = leaf;
  for (const item of proof) {
    current = item.position === "left"
      ? hashPair(item.hash, current)
      : hashPair(current, item.hash);
  }
  return current === root;
}
