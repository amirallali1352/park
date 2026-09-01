import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { AnalyticsAggregator } from "../src/analytics/aggregator.js";

test("serves tenant-scoped KPI dashboard data", async () => {
  const analytics = new AnalyticsAggregator();
  analytics.consume({
    type: "BookingConfirmed", tenantId: "park-1",
    payload: { durationMinutes: 90, amount: 300 }
  });
  const server = createApiServer(undefined, { analytics });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/analytics/kpis`, {
      headers: { "x-tenant-id": "park-1" }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).utilizationMinutes, 90);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
