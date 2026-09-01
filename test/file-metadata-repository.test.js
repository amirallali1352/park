import assert from "node:assert/strict";
import test from "node:test";
import { PostgresFileMetadataRepository } from "../src/infrastructure/postgres-file-metadata-repository.js";

test("persists file metadata with tenant context and parameterized SQL", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO file_metadata")) {
        return { rows: [{
          tenant_id: values[1], object_id: values[0], bucket: values[2], storage_key: values[3],
          content_type: values[4], size_bytes: values[5], envelope_version: values[6]
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresFileMetadataRepository(client);
  const metadata = {
    objectId: "result-1", tenantId: "park-1", bucket: "files",
    storageKey: "park-1/hash", contentType: "text/plain",
    size: 42, envelopeVersion: 1
  };
  assert.deepEqual(await repository.save(metadata), metadata);
  assert.equal(calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(calls[1].text, /INSERT INTO file_metadata/);
  assert.deepEqual(calls[1].values, [
    "result-1", "park-1", "files", "park-1/hash", "text/plain", 42, 1
  ]);
});

test("finds and removes metadata inside the tenant boundary", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("SELECT")) return { rows: [{ object_id: "f-1", tenant_id: "park-1" }] };
      return { rows: [] };
    }
  };
  const repository = new PostgresFileMetadataRepository(client);
  assert.equal((await repository.find("park-1", "f-1")).objectId, "f-1");
  await repository.remove("park-1", "f-1");
  assert.match(calls.at(-1).text, /DELETE FROM file_metadata/);
});
