import assert from "node:assert/strict";
import test from "node:test";
import { S3ObjectStorage } from "../src/infrastructure/s3-object-storage.js";

test("maps object storage operations to S3 commands", async () => {
  const calls = [];
  const client = { send: async (command) => {
    calls.push(command);
    return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } };
  } };
  const storage = new S3ObjectStorage({ client, PutObjectCommand: class Put {
    constructor(input) { this.input = input; }
  }, GetObjectCommand: class Get {
    constructor(input) { this.input = input; }
  }, DeleteObjectCommand: class Delete {
    constructor(input) { this.input = input; }
  } });

  await storage.put("bucket-a", "tenant/file", Buffer.from([9]));
  assert.deepEqual(await storage.get("bucket-a", "tenant/file"), Buffer.from([1, 2, 3]));
  await storage.delete("bucket-a", "tenant/file");
  assert.deepEqual(calls.map((command) => command.input), [
    { Bucket: "bucket-a", Key: "tenant/file", Body: Buffer.from([9]) },
    { Bucket: "bucket-a", Key: "tenant/file" },
    { Bucket: "bucket-a", Key: "tenant/file" }
  ]);
});

test("returns null when S3 reports a missing object", async () => {
  const storage = new S3ObjectStorage({
    client: { send: async () => { throw Object.assign(new Error("missing"), { name: "NoSuchKey" }); } },
    GetObjectCommand: class Get { constructor(input) { this.input = input; } }
  });
  assert.equal(await storage.get("bucket", "missing"), null);
});
