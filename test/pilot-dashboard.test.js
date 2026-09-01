import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/api/server.js";
import { AnalyticsAggregator } from "../src/analytics/aggregator.js";

test("returns a tenant-scoped Pilot summary", async () => {
  const analytics = new AnalyticsAggregator();
  analytics.consume({
    type: "BookingConfirmed",
    tenantId: "park-1",
    payload: { durationMinutes: 120, amount: 450 }
  });
  analytics.consume({
    type: "PaymentSettled",
    tenantId: "park-1",
    payload: { category: "rd", amount: 450 }
  });
  const server = createApiServer(undefined, {
    analytics,
    facilityRepository: {
      async listEquipment(tenantId) {
        assert.equal(tenantId, "park-1");
        return [
          { id: "eq-1", status: "available" },
          { id: "eq-2", status: "maintenance" }
        ];
      },
      async listBookings(tenantId) {
        assert.equal(tenantId, "park-1");
        return [{ id: "booking-1" }];
      }
    },
    sampleRepository: {
      async listSamples(tenantId) {
        assert.equal(tenantId, "park-1");
        return [{ id: "sample-1" }, { id: "sample-2" }];
      }
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/pilot/summary`,
      { headers: { "x-tenant-id": "park-1" } }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      tenantId: "park-1",
      equipmentCount: 2,
      availableEquipmentCount: 1,
      bookingCount: 1,
      sampleCount: 2,
      kpis: {
        bookingCount: 1,
        utilizationMinutes: 120,
        rdSpend: 450
      }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("serves the initial Pilot dashboard shell", async () => {
  const server = createApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/pilot/dashboard`
    );
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(html, /STP OS Pilot Dashboard/);
    assert.match(html, /\/api\/v1\/pilot\/summary/);
    assert.match(html, /x-tenant-id/);
    assert.match(html, /Register Equipment/);
    assert.match(html, /Create Sample/);
    assert.match(html, /Create Booking/);
    assert.match(html, /\/api\/v1\/equipment/);
    assert.match(html, /\/api\/v1\/samples/);
    assert.match(html, /\/api\/v1\/bookings/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /#tenant-form/);
    assert.match(html, /grid-template-columns: repeat\(auto-fit/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("requires Pilot dashboard login when API authentication is enabled", async () => {
  const server = createApiServer(undefined, {
    authRequired: true,
    authSecret: "pilot-test-secret"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/pilot/summary`,
      { headers: { "x-tenant-id": "park-1" } }
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "AUTH_REQUIRED", message: "Bearer access token is required." }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("derives Pilot booking KPIs from persisted bookings after restart", async () => {
  const server = createApiServer(undefined, {
    facilityRepository: {
      async listEquipment() { return []; },
      async listBookings() {
        return [{
          id: "booking-1",
          startAt: "2026-09-02T10:00:00.000Z",
          endAt: "2026-09-02T12:30:00.000Z",
          amount: 450
        }];
      }
    },
    sampleRepository: { async listSamples() { return []; } }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/pilot/summary`,
      { headers: { "x-tenant-id": "park-1" } }
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).kpis, {
      bookingCount: 1,
      utilizationMinutes: 150,
      rdSpend: 0
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
