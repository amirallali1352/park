import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify
} from "node:crypto";

export class DigitalSignatureError extends Error {
  constructor(message, code = "DIGITAL_SIGNATURE_ERROR") {
    super(message);
    this.name = "DigitalSignatureError";
    this.code = code;
  }
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function contractDigest(contract) {
  return createHash("sha256").update(canonical({
    id: contract.id, tenantId: contract.tenantId, type: contract.type,
    title: contract.title, parties: contract.parties, terms: contract.terms,
    version: contract.version, document: contract.document
  })).digest("hex");
}

export class LocalEd25519SignatureProvider {
  constructor({ keys = {} } = {}) {
    this.keys = new Map(Object.entries(keys));
  }

  static generate({ partyId } = {}) {
    if (!partyId) throw new DigitalSignatureError("partyId is required.", "INVALID_PARTY");
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    return new LocalEd25519SignatureProvider({
      keys: {
        [partyId]: {
          privateKey,
          publicKey: publicKey.export({ type: "spki", format: "pem" })
        }
      }
    });
  }

  sign(contract, { partyId, signedAt = new Date().toISOString() } = {}) {
    const key = this.keys.get(partyId);
    if (!key?.privateKey) {
      throw new DigitalSignatureError("Signing key was not found.", "SIGNING_KEY_NOT_FOUND");
    }
    const digest = contractDigest(contract);
    return {
      algorithm: "Ed25519",
      digest,
      signature: cryptoSign(null, Buffer.from(digest), key.privateKey).toString("base64"),
      publicKey: key.publicKey,
      signedAt
    };
  }

  verify(contract, signature) {
    if (!signature?.algorithm || !signature?.digest || !signature?.signature || !signature?.publicKey) {
      throw new DigitalSignatureError("Signature fields are required.", "INVALID_SIGNATURE");
    }
    if (signature.algorithm !== "Ed25519" || signature.digest !== contractDigest(contract)) return false;
    try {
      return cryptoVerify(
        null,
        Buffer.from(signature.digest),
        signature.publicKey,
        Buffer.from(signature.signature, "base64")
      );
    } catch {
      return false;
    }
  }
}
