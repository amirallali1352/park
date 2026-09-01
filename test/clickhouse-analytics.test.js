import assert from "node:assert/strict";
import test from "node:test";
import { ClickHouseAnalyticsSink } from "../src/analytics/clickhouse-sink.js";

test("writes analytics events to ClickHouse with parameterized values", async () => {
  const calls = [];
  const client = {
    async insert(params) { calls.push(params); }
  };
  const sink = new ClickHouseAnalyticsSink({ client, table: "stp_events" });
  await sink.write({
    id: "event-1", type: "BookingConfirmed", tenantId: "park-1",
    occurredAt: "2026-09-01T00:00:00.000Z", payload: { amount: 100 }
  });
  assert.equal(calls[0].table, "stp_events");
  assert.deepEqual(calls[0].values, [{
    event_id: "event-1",
    event_type: "BookingConfirmed",
    tenant_id: "park-1",
    occurred_at: "2026-09-01T00:00:00.000Z",
    payload: JSON.stringify({ amount: 100 })
  }]);
});
