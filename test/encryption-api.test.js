import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";

test("encrypts and decrypts a tenant file through the API", async () => {
  const server = createApiServer(undefined, { encryptionKek: "d".repeat(32) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${base}/api/v1/files/encrypt`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({
        objectId: "file-1",
        contentBase64: Buffer.from("confidential lab result").toString("base64")
      })
    });
    assert.equal(response.status, 201);
    const envelope = await response.json();
    assert.equal(envelope.tenantId, "park-1");
    assert.equal(envelope.contentBase64, undefined);

    response = await fetch(`${base}/api/v1/files/decrypt`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ envelope })
    });
    assert.equal(response.status, 200);
    assert.equal(
      Buffer.from((await response.json()).contentBase64, "base64").toString(),
      "confidential lab result"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
