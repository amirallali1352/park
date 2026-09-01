import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryLegalRepository } from "../src/infrastructure/in-memory-legal-repository.js";
import { LocalEd25519SignatureProvider } from "../src/security/digital-signature.js";

test("returns a cryptographic signature and verifies it through the API", async () => {
  const legalRepository = new InMemoryLegalRepository();
  const signatureProvider = LocalEd25519SignatureProvider.generate({ partyId: "park-1" });
  const server = createApiServer(undefined, { legalRepository, signatureProvider });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
  try {
    await fetch(`${base}/api/v1/contracts`, {
      method: "POST", headers,
      body: JSON.stringify({
        id: "nda-sign-api", type: "mNDA", title: "NDA",
        parties: ["park-1", "startup-1"], terms: {}
      })
    });
    const response = await fetch(`${base}/api/v1/contracts/nda-sign-api/sign`, {
      method: "POST", headers,
      body: JSON.stringify({ partyId: "park-1", signatureRef: "local-esign" })
    });
    assert.equal(response.status, 200);
    const signed = await response.json();
    assert.equal(signed.signatures[0].digitalSignature.algorithm, "Ed25519");

    const verify = await fetch(`${base}/api/v1/contracts/nda-sign-api/verify`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(verify.status, 200);
    assert.equal((await verify.json()).valid, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
