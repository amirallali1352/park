import { createHash } from "node:crypto";
import { EncryptionError } from "./encryption.js";

function fileError(message, code) {
  const error = new Error(message);
  error.name = "EncryptedFileError";
  error.code = code;
  return error;
}

function storageKey(tenantId, objectId) {
  return `${tenantId}/${createHash("sha256").update(objectId).digest("hex")}`;
}

export class EncryptedFileService {
  #metadata = new Map();

  constructor({ encryption, storage, bucket = "stp-encrypted-files" } = {}) {
    if (!encryption || typeof encryption.encrypt !== "function" || typeof encryption.decrypt !== "function") {
      throw new TypeError("An envelope encryption service is required.");
    }
    if (!storage || typeof storage.put !== "function" || typeof storage.get !== "function") {
      throw new TypeError("An object storage adapter is required.");
    }
    this.encryption = encryption;
    this.storage = storage;
    this.bucket = bucket;
  }

  async put({ tenantId, objectId, content, contentType = "application/octet-stream" } = {}) {
    if (!tenantId || !objectId || !Buffer.isBuffer(content)) {
      throw fileError("tenantId, objectId and binary content are required.", "INVALID_FILE");
    }
    const envelope = this.encryption.encrypt(content, { tenantId, objectId });
    const encryptedBytes = Buffer.from(JSON.stringify({
      envelope,
      contentType,
      size: content.length
    }), "utf8");
    const key = storageKey(tenantId, objectId);
    await this.storage.put(this.bucket, key, encryptedBytes);
    const metadata = {
      tenantId,
      objectId,
      bucket: this.bucket,
      storageKey: key,
      contentType,
      size: content.length,
      envelopeVersion: envelope.version
    };
    this.#metadata.set(`${tenantId}/${objectId}`, metadata);
    return metadata;
  }

  async get({ tenantId, objectId } = {}) {
    const key = storageKey(tenantId, objectId);
    const encryptedBytes = await this.storage.get(this.bucket, key);
    if (!encryptedBytes) throw fileError("Encrypted file was not found.", "FILE_NOT_FOUND");
    try {
      const stored = JSON.parse(encryptedBytes.toString("utf8"));
      const envelope = stored.envelope ?? stored;
      const content = this.encryption.decrypt(envelope, { tenantId, objectId });
      const metadata = this.#metadata.get(`${tenantId}/${objectId}`) ?? {
        tenantId,
        objectId,
        bucket: this.bucket,
        storageKey: key,
        contentType: stored.contentType ?? "application/octet-stream",
        size: stored.size ?? content.length,
        envelopeVersion: envelope.version
      };
      return {
        content,
        contentType: metadata.contentType,
        metadata
      };
    } catch (error) {
      if (error instanceof EncryptionError) throw error;
      throw fileError("Stored encrypted file is invalid.", "INVALID_STORED_FILE");
    }
  }

  async remove({ tenantId, objectId } = {}) {
    const key = storageKey(tenantId, objectId);
    if (!await this.storage.get(this.bucket, key)) {
      throw fileError("Encrypted file was not found.", "FILE_NOT_FOUND");
    }
    await this.storage.delete(this.bucket, key);
    this.#metadata.delete(`${tenantId}/${objectId}`);
  }
}
