import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { EncryptedFileService } from "../src/security/encrypted-file-service.js";
import { EnvelopeEncryption } from "../src/security/encryption.js";
import { InMemoryObjectStorage } from "../src/infrastructure/in-memory-object-storage.js";

test("stores, downloads, and deletes an encrypted file through the API", async () => {
  const fileService = new EncryptedFileService({
    encryption: new EnvelopeEncryption({ kek: "g".repeat(32) }),
    storage: new InMemoryObjectStorage()
  });
  const server = createApiServer(undefined, { fileService });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    const contentBase64 = Buffer.from("HPLC encrypted result").toString("base64");
    let response = await fetch(`${base}/api/v1/files`, {
      method: "POST", headers,
      body: JSON.stringify({ objectId: "result-1", contentType: "text/plain", contentBase64 })
    });
    assert.equal(response.status, 201);
    const metadata = await response.json();
    assert.equal(metadata.contentType, "text/plain");

    response = await fetch(`${base}/api/v1/files/result-1`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).contentBase64, contentBase64);

    response = await fetch(`${base}/api/v1/files/result-1`, { method: "DELETE", headers });
    assert.equal(response.status, 204);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
