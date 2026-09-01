import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export class EncryptionError extends Error {
  constructor(message, code = "ENCRYPTION_ERROR") {
    super(message);
    this.name = "EncryptionError";
    this.code = code;
  }
}

function base64(value) {
  return Buffer.from(value).toString("base64");
}

function fromBase64(value) {
  try {
    return Buffer.from(value, "base64");
  } catch {
    throw new EncryptionError("Invalid encrypted value.", "INVALID_ENCRYPTED_VALUE");
  }
}

function normalizeKey(value) {
  if (typeof value !== "string" && !Buffer.isBuffer(value)) {
    throw new EncryptionError("A KEK is required.", "INVALID_KEK");
  }
  return createHash("sha256").update(value).digest();
}

function encryptWithKey(key, plaintext, associatedData) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv: base64(iv), ciphertext: base64(ciphertext), authTag: base64(cipher.getAuthTag()) };
}

function decryptWithKey(key, encrypted, associatedData) {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, fromBase64(encrypted.iv));
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(fromBase64(encrypted.authTag));
    return Buffer.concat([
      decipher.update(fromBase64(encrypted.ciphertext)),
      decipher.final()
    ]);
  } catch {
    throw new EncryptionError("Encrypted object authentication failed.", "DECRYPTION_FAILED");
  }
}

export class EnvelopeEncryption {
  constructor({ kek } = {}) {
    this.kek = normalizeKey(kek ?? process.env.ENCRYPTION_KEK);
  }

  encrypt(content, { tenantId, objectId } = {}) {
    if (!tenantId || !objectId) {
      throw new EncryptionError(
        "tenantId and objectId are required.",
        "INVALID_ENCRYPTION_CONTEXT"
      );
    }
    if (!Buffer.isBuffer(content) && !(content instanceof Uint8Array)) {
      throw new EncryptionError("Content must be binary.", "INVALID_CONTENT");
    }

    const dek = randomBytes(KEY_LENGTH);
    const data = encryptWithKey(
      dek,
      Buffer.from(content),
      `${tenantId}:${objectId}`
    );
    const wrapped = encryptWithKey(this.kek, dek, tenantId);

    return {
      version: 1,
      tenantId,
      objectId,
      algorithm: ALGORITHM,
      keyWrappingAlgorithm: ALGORITHM,
      iv: data.iv,
      authTag: data.authTag,
      ciphertext: data.ciphertext,
      wrappedDek: wrapped.ciphertext,
      wrappedDekIv: wrapped.iv,
      wrappedDekAuthTag: wrapped.authTag
    };
  }

  decrypt(envelope, { tenantId = envelope?.tenantId, objectId = envelope?.objectId } = {}) {
    if (!envelope?.tenantId || !envelope?.objectId || !tenantId || !objectId) {
      throw new EncryptionError(
        "tenantId and objectId are required.",
        "INVALID_ENCRYPTION_CONTEXT"
      );
    }
    if (tenantId !== envelope.tenantId || objectId !== envelope.objectId) {
      throw new EncryptionError("Encryption context does not match.", "CONTEXT_MISMATCH");
    }
    const dek = decryptWithKey(this.kek, {
      iv: envelope.wrappedDekIv,
      authTag: envelope.wrappedDekAuthTag,
      ciphertext: envelope.wrappedDek
    }, tenantId);
    return decryptWithKey(this.#assertKey(dek), envelope, `${tenantId}:${objectId}`);
  }

  #assertKey(key) {
    if (key.length !== KEY_LENGTH) {
      throw new EncryptionError("Invalid wrapped DEK.", "DECRYPTION_FAILED");
    }
    return key;
  }
}
