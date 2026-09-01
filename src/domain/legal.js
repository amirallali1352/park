export const ContractType = Object.freeze({ MNDA: "mNDA", MSA: "MSA" });
export const ContractStatus = Object.freeze({
  DRAFT: "draft",
  PENDING_SIGNATURES: "pending_signatures",
  ACTIVE: "active"
});

export class LegalError extends Error {
  constructor(message, code = "LEGAL_ERROR") {
    super(message);
    this.name = "LegalError";
    this.code = code;
  }
}

function renderDocument({ title, type, parties, terms }) {
  return [
    `${title} (${type})`,
    `Parties: ${parties.join(", ")}`,
    "The parties agree to protect confidential technical and commercial information.",
    `Terms: ${JSON.stringify(terms ?? {})}`
  ].join("\n");
}

export function createContract({ id, tenantId, type, title, parties, terms = {}, version = 1 }) {
  if (!id || !tenantId || !Object.values(ContractType).includes(type) ||
      !title || !Array.isArray(parties) || parties.length < 2 ||
      parties.some((party) => typeof party !== "string" || !party)) {
    throw new LegalError("Contract fields and at least two parties are required.", "INVALID_CONTRACT");
  }
  return Object.freeze({
    id, tenantId, type, title, parties: [...new Set(parties)], terms,
    version, status: ContractStatus.DRAFT, signatures: [],
    document: renderDocument({ title, type, parties, terms }),
    createdAt: new Date().toISOString()
  });
}

export function signContract(contract, { partyId, signatureRef, signedAt = new Date().toISOString() } = {}) {
  if (!contract || !contract.parties.includes(partyId) || !signatureRef) {
    throw new LegalError("A valid party and signature reference are required.", "INVALID_SIGNATURE");
  }
  if (contract.signatures.some((signature) => signature.partyId === partyId)) {
    throw new LegalError("This party has already signed the contract.", "DUPLICATE_SIGNATURE");
  }
  const signatures = [...contract.signatures, { partyId, signatureRef, signedAt }];
  return Object.freeze({
    ...contract,
    status: signatures.length === contract.parties.length
      ? ContractStatus.ACTIVE : ContractStatus.PENDING_SIGNATURES,
    signatures
  });
}
