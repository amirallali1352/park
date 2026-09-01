import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";

async function withServer(run) {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    return await run(`http://${address.address}:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("creates a sample and records custody events", async () => {
  await withServer(async (baseUrl) => {
    const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
    let response = await fetch(`${baseUrl}/api/v1/samples`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "sample-1", name: "Water", barcode: "S-1", submittedBy: "u-1"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/samples/sample-1/custody`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: "event-1", actorId: "u-1", action: "received", location: "Lab A" })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/samples/sample-1/custody`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((event) => event.action), ["received"]);
  });
});

test("does not expose another tenant's sample", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/samples`, {
      headers: { "x-tenant-id": "park-2" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });
});
