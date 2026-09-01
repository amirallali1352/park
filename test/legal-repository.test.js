import assert from "node:assert/strict";
import test from "node:test";
import { PostgresLegalRepository } from "../src/infrastructure/postgres-legal-repository.js";

test("persists contracts with tenant-scoped SQL", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO legal_contracts")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], type: values[2], title: values[3],
          parties: values[4], terms: values[5], version: values[6], status: values[7],
          signatures: values[8], document: values[9], created_at: "2026-09-01T00:00:00.000Z"
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresLegalRepository(client);
  const contract = {
    id: "nda-1", tenantId: "park-1", type: "mNDA", title: "NDA",
    parties: ["park-1", "startup-1"], terms: {}, version: 1,
    status: "draft", signatures: [], document: "NDA", createdAt: "2026-09-01T00:00:00.000Z"
  };
  assert.deepEqual(await repository.save(contract), contract);
  assert.equal(calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(calls[1].text, /INSERT INTO legal_contracts/);
});
