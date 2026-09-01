import assert from "node:assert/strict";
import test from "node:test";
import { PostgresMarketplaceRepository } from "../src/infrastructure/postgres-marketplace-repository.js";

test("persists marketplace listings with tenant-scoped SQL", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO marketplace_listings")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], type: values[2], title: values[3],
          summary: values[4], capabilities: values[5], tags: values[6],
          status: values[7], version: values[8], created_at: "2026-09-01T00:00:00.000Z"
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresMarketplaceRepository(client);
  const listing = {
    id: "offer-1", tenantId: "park-1", type: "tech_offer", title: "HPLC",
    summary: "Analysis", capabilities: ["HPLC"], tags: ["chemistry"],
    status: "open", version: 1, createdAt: "2026-09-01T00:00:00.000Z"
  };
  assert.deepEqual(await repository.save(listing), listing);
  assert.equal(calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(calls[1].text, /INSERT INTO marketplace_listings/);
});
