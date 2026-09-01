import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { EncryptedFileService } from "../src/security/encrypted-file-service.js";
import { EnvelopeEncryption } from "../src/security/encryption.js";
import { InMemoryObjectStorage } from "../src/infrastructure/in-memory-object-storage.js";
import { InMemoryAuditRepository } from "../src/infrastructure/in-memory-audit-repository.js";

test("audits file creation and deletion", async () => {
  const auditRepository = new InMemoryAuditRepository();
  const fileService = new EncryptedFileService({
    encryption: new EnvelopeEncryption({ kek: "h".repeat(32) }),
    storage: new InMemoryObjectStorage()
  });
  const server = createApiServer(undefined, { fileService, auditRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    const response = await fetch(`${base}/api/v1/files`, {
      method: "POST", headers,
      body: JSON.stringify({ objectId: "audit-file", contentBase64: "YQ==" })
    });
    assert.equal(response.status, 201);
    await fetch(`${base}/api/v1/files/audit-file`, { method: "DELETE", headers });
    assert.deepEqual((await auditRepository.list("park-1")).map((event) => event.action), [
      "file.created", "file.deleted"
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
