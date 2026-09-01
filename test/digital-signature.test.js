import assert from "node:assert/strict";
import test from "node:test";
import { createContract } from "../src/domain/legal.js";
import {
  DigitalSignatureError,
  LocalEd25519SignatureProvider,
  contractDigest
} from "../src/security/digital-signature.js";

function contract() {
  return createContract({
    id: "nda-sign-1", tenantId: "park-1", type: "mNDA",
    title: "Mutual NDA", parties: ["park-1", "startup-1"],
    terms: { governingLaw: "TR" }
  });
}

test("signs and verifies the exact contract digest", () => {
  const provider = LocalEd25519SignatureProvider.generate({
    partyId: "park-1"
  });
  const signed = provider.sign(contract(), { partyId: "park-1" });
  assert.equal(signed.algorithm, "Ed25519");
  assert.equal(signed.digest, contractDigest(contract()));
  assert.equal(provider.verify(contract(), signed), true);
  assert.equal(provider.verify({ ...contract(), title: "Tampered" }, signed), false);
});

test("rejects missing party keys and malformed signatures", () => {
  const provider = LocalEd25519SignatureProvider.generate({ partyId: "park-1" });
  assert.throws(() => provider.sign(contract(), { partyId: "startup-1" }), {
    code: "SIGNING_KEY_NOT_FOUND"
  });
  assert.throws(() => provider.verify(contract(), {}), DigitalSignatureError);
});
