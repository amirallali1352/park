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

test("creates and lists equipment maintenance windows", async () => {
  await withServer(async (baseUrl) => {
    const headers = { "content-type": "application/json", "x-tenant-id": "park-1" };
    let response = await fetch(`${baseUrl}/api/v1/equipment`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "eq-1", name: "HPLC", type: "hplc", accessModel: "operator_assisted"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/equipment/eq-1/maintenance`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "m-1", type: "calibration",
        startAt: "2026-09-05T10:00:00Z", endAt: "2026-09-05T12:00:00Z"
      })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${baseUrl}/api/v1/equipment/eq-1/maintenance`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map((item) => item.id), ["m-1"]);
  });
});
