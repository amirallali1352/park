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
    occurred_at: "2026-09-01 00:00:00.000",
    payload: JSON.stringify({ amount: 100 })
  }]);
});

test("reads tenant KPI snapshots from persisted ClickHouse events", async () => {
  const calls = [];
  const client = {
    async insert() {},
    async query(params) {
      calls.push(params);
      return {
        async json() {
          return [{
            booking_count: "3",
            utilization_minutes: "180",
            rd_spend: "900",
            economic_output: "1200"
          }];
        }
      };
    }
  };
  const sink = new ClickHouseAnalyticsSink({ client, table: "stp_events" });
  assert.deepEqual(await sink.snapshot("park-1"), {
    tenantId: "park-1",
    bookingCount: 3,
    utilizationMinutes: 180,
    rdSpend: 900,
    economicOutput: 1200
  });
  assert.equal(calls[0].query_params.tenantId, "park-1");
  assert.match(calls[0].query, /GROUP BY event_id/);
});
