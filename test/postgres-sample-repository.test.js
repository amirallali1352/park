import assert from "node:assert/strict";
import test from "node:test";
import { createSample } from "../src/domain/sample.js";
import { PostgresSampleRepository } from "../src/infrastructure/postgres-sample-repository.js";

test("writes samples with tenant context and parameterized SQL", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO samples")) {
        return { rows: [{ id: values[0], tenant_id: values[1], name: values[2], barcode: values[3], submitted_by: values[4], status: values[5] }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresSampleRepository(client);
  const sample = createSample({
    id: "s-1", tenantId: "park-1", name: "Water", barcode: "B-1", submittedBy: "u-1"
  });
  assert.deepEqual(await repository.saveSample(sample), sample);
  assert.equal(calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(calls[1].text, /INSERT INTO samples/);
});
