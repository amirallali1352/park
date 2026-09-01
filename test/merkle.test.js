import assert from "node:assert/strict";
import test from "node:test";
import { createAuditEvent } from "../src/security/audit.js";
import { buildMerkleProof, merkleRoot, verifyMerkleProof } from "../src/security/merkle.js";

function events() {
  return ["1", "2", "3"].map((id) => createAuditEvent({
    id: `audit-${id}`, tenantId: "park-1", actorId: "u-1",
    action: "booking.created", resourceType: "booking", resourceId: `b-${id}`, payload: { id }
  }));
}

test("builds a deterministic Merkle root", () => {
  const values = events().map((event) => event.hash);
  assert.equal(merkleRoot(values), merkleRoot(values));
  assert.equal(merkleRoot(values).length, 64);
});

test("creates and verifies a Merkle inclusion proof", () => {
  const values = events().map((event) => event.hash);
  const proof = buildMerkleProof(values, 1);
  assert.equal(verifyMerkleProof(values[1], proof, merkleRoot(values)), true);
  assert.equal(verifyMerkleProof("0".repeat(64), proof, merkleRoot(values)), false);
});

test("rejects invalid proof indexes", () => {
  assert.throws(() => buildMerkleProof(["a"], 3), /index/);
});
