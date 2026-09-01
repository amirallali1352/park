import assert from "node:assert/strict";
import test from "node:test";
import { AnalyticsAggregator } from "../src/analytics/aggregator.js";

test("aggregates booking utilization and R&D spend per tenant", () => {
  const analytics = new AnalyticsAggregator();
  analytics.consume({
    type: "BookingConfirmed", tenantId: "park-1",
    payload: { equipmentId: "hplc-1", durationMinutes: 120, amount: 250 }
  });
  analytics.consume({
    type: "PaymentSettled", tenantId: "park-1",
    payload: { category: "rd", amount: 1000 }
  });
  analytics.consume({
    type: "BookingConfirmed", tenantId: "park-2",
    payload: { equipmentId: "sem-1", durationMinutes: 30, amount: 50 }
  });

  assert.deepEqual(analytics.snapshot("park-1"), {
    tenantId: "park-1",
    bookingCount: 1,
    utilizationMinutes: 120,
    rdSpend: 1000,
    economicOutput: 250
  });
  assert.equal(analytics.snapshot("park-2").utilizationMinutes, 30);
});

test("processes each event once", () => {
  const analytics = new AnalyticsAggregator();
  const event = {
    id: "event-1", type: "BookingConfirmed", tenantId: "park-1",
    payload: { durationMinutes: 60, amount: 10 }
  };
  analytics.consume(event);
  analytics.consume(event);
  assert.equal(analytics.snapshot("park-1").bookingCount, 1);
});
