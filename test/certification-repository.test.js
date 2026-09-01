import assert from "node:assert/strict";
import test from "node:test";
import { PostgresCertificationRepository } from "../src/infrastructure/postgres-certification-repository.js";

test("persists certifications with tenant context", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO equipment_certifications")) {
        return {
          rows: [{
            id: "cert-1", tenant_id: "park-1", equipment_id: "eq-1",
            user_id: "user-1", expires_at: "2027-09-01T00:00:00.000Z",
            created_at: "2026-09-01T00:00:00.000Z"
          }]
        };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresCertificationRepository(client);
  const result = await repository.save({
    id: "cert-1", tenantId: "park-1", equipmentId: "eq-1", userId: "user-1",
    expiresAt: "2027-09-01T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z"
  });
  assert.equal(result.tenantId, "park-1");
  assert.match(calls[0].text, /set_config\('app\.tenant_id'/);
  assert.match(calls[1].text, /INSERT INTO equipment_certifications/);
});
