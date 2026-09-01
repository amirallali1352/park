import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { InMemoryAuditRepository } from "../src/infrastructure/in-memory-audit-repository.js";

test("returns a Merkle proof for a tenant audit event", async () => {
  const audit = new InMemoryAuditRepository();
  const server = createApiServer(undefined, { auditRepository: audit });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const equipment = await fetch(`${base}/api/v1/equipment`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tenant-id": "park-1" },
      body: JSON.stringify({ id: "eq-merkle", name: "SEM", type: "sem", accessModel: "operator_assisted" })
    });
    assert.equal(equipment.status, 201);
    const response = await fetch(`${base}/api/v1/audit/proof`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    const proof = await response.json();
    assert.equal(proof.root.length, 64);
    assert.equal(proof.event.hash.length, 64);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
