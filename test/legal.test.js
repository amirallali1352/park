import assert from "node:assert/strict";
import test from "node:test";
import { ContractType, ContractStatus, createContract, signContract } from "../src/domain/legal.js";

test("creates a versioned mNDA or MSA draft", () => {
  const contract = createContract({
    id: "nda-1", tenantId: "park-1", type: ContractType.MNDA,
    title: "Mutual NDA", parties: ["park-1", "startup-1"],
    terms: { confidentialityDays: 1095 }
  });
  assert.equal(contract.status, ContractStatus.DRAFT);
  assert.equal(contract.version, 1);
  assert.match(contract.document, /Mutual NDA/);
  assert.match(contract.document, /confidentialityDays/);
});

test("activates only after every party signs", () => {
  let contract = createContract({
    id: "msa-1", tenantId: "park-1", type: ContractType.MSA,
    title: "Master Services Agreement", parties: ["park-1", "startup-1"]
  });
  contract = signContract(contract, { partyId: "park-1", signatureRef: "sig-a" });
  assert.equal(contract.status, ContractStatus.PENDING_SIGNATURES);
  contract = signContract(contract, { partyId: "startup-1", signatureRef: "sig-b" });
  assert.equal(contract.status, ContractStatus.ACTIVE);
  assert.equal(contract.signatures.length, 2);
});

test("rejects duplicate signatures and unsupported contract types", () => {
  assert.throws(() => createContract({
    id: "bad", tenantId: "park-1", type: "lease", title: "Bad", parties: ["park-1"]
  }), { code: "INVALID_CONTRACT" });
  const contract = createContract({
    id: "nda-2", tenantId: "park-1", type: ContractType.MNDA,
    title: "NDA", parties: ["park-1", "startup-1"]
  });
  const signed = signContract(contract, { partyId: "park-1", signatureRef: "sig" });
  assert.throws(() => signContract(signed, { partyId: "park-1", signatureRef: "sig-2" }), {
    code: "DUPLICATE_SIGNATURE"
  });
});
