import assert from "node:assert/strict";
import test from "node:test";
import { EnvelopeEncryption } from "../src/security/encryption.js";
import { EncryptedFileService } from "../src/security/encrypted-file-service.js";
import { InMemoryObjectStorage } from "../src/infrastructure/in-memory-object-storage.js";

test("stores only encrypted bytes and restores a tenant file", async () => {
  const storage = new InMemoryObjectStorage();
  const service = new EncryptedFileService({
    encryption: new EnvelopeEncryption({ kek: "e".repeat(32) }),
    storage,
    bucket: "lab-files"
  });

  const saved = await service.put({
    tenantId: "park-1",
    objectId: "result-1",
    contentType: "application/octet-stream",
    content: Buffer.from("raw instrument data")
  });

  assert.equal(saved.tenantId, "park-1");
  assert.equal(saved.objectId, "result-1");
  assert.equal(saved.bucket, "lab-files");
  assert.notEqual(saved.storageKey, "raw instrument data");
  assert.deepEqual(await service.get({ tenantId: "park-1", objectId: "result-1" }), {
    content: Buffer.from("raw instrument data"),
    contentType: "application/octet-stream",
    metadata: saved
  });
  assert.notDeepEqual(await storage.get("lab-files", saved.storageKey), Buffer.from("raw instrument data"));
});

test("does not allow another tenant to read or delete an object", async () => {
  const storage = new InMemoryObjectStorage();
  const service = new EncryptedFileService({
    encryption: new EnvelopeEncryption({ kek: "f".repeat(32) }),
    storage
  });
  await service.put({ tenantId: "park-1", objectId: "file-1", content: Buffer.from("secret") });

  await assert.rejects(
    () => service.get({ tenantId: "park-2", objectId: "file-1" }),
    { code: "FILE_NOT_FOUND" }
  );
  await assert.rejects(
    () => service.remove({ tenantId: "park-2", objectId: "file-1" }),
    { code: "FILE_NOT_FOUND" }
  );
});
