import assert from "node:assert/strict";
import test from "node:test";
import { createObjectStorage } from "../src/infrastructure/create-object-storage.js";

test("creates an S3 object storage adapter from configuration", () => {
  const storage = createObjectStorage({
    endpoint: "http://127.0.0.1:9000",
    accessKeyId: "minio",
    secretAccessKey: "secret"
  });
  assert.equal(typeof storage.put, "function");
  assert.equal(typeof storage.get, "function");
  assert.equal(typeof storage.delete, "function");
});

test("requires S3 connection settings", () => {
  assert.throws(() => createObjectStorage({}), /S3_ENDPOINT/);
});
