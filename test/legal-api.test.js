import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryLegalRepository } from "../src/infrastructure/in-memory-legal-repository.js";

test("creates and signs a legal wrapper through the API", async () => {
  const legalRepository = new InMemoryLegalRepository();
  const server = createApiServer(undefined, { legalRepository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    let response = await fetch(`${base}/api/v1/contracts`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "nda-api-1", type: "mNDA", title: "Mutual NDA",
        parties: ["park-1", "startup-1"], terms: { governingLaw: "TR" }
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/api/v1/contracts/nda-api-1/sign`, {
      method: "POST", headers,
      body: JSON.stringify({ partyId: "park-1", signatureRef: "esign-1" })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "pending_signatures");
    response = await fetch(`${base}/api/v1/contracts/nda-api-1/sign`, {
      method: "POST", headers,
      body: JSON.stringify({ partyId: "startup-1", signatureRef: "esign-2" })
    });
    assert.equal((await response.json()).status, "active");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("requires an active legal wrapper before technical data exchange when enabled", async () => {
  const server = createApiServer(undefined, {
    requireLegalWrapper: true,
    legalRepository: new InMemoryLegalRepository(),
    encryptionKek: "i".repeat(32)
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/files`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ objectId: "blocked", contentBase64: "YQ==" })
    });
    assert.equal(response.status, 412);
    assert.equal((await response.json()).error.code, "LEGAL_WRAPPER_REQUIRED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
