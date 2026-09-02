import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPerformanceBudget,
  buildBookingPayload,
  operationalScenarioNames,
  summarizeScenario
} from "../scripts/operational-load.mjs";

test("defines the operational Pilot load scenarios", () => {
  assert.deepEqual(operationalScenarioNames(), [
    "login",
    "equipment",
    "booking",
    "dashboard"
  ]);
});

test("builds non-overlapping booking payloads for concurrent load", () => {
  const first = buildBookingPayload("tenant-1", "equipment-1", "user-1", 0);
  const second = buildBookingPayload("tenant-1", "equipment-1", "user-1", 1);

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.startAt, second.startAt);
  assert.equal(first.endAt, "2026-09-03T10:30:00.000Z");
  assert.equal(second.startAt, "2026-09-03T10:30:00.000Z");
});

test("summarizes an operational scenario with pass rate", () => {
  assert.deepEqual(summarizeScenario([10, 20, 30], 1), {
    count: 3,
    errors: 1,
    successRate: 66.67,
    minMs: 10,
    maxMs: 30,
    avgMs: 20,
    p50Ms: 20,
    p95Ms: 30
  });
});

test("rejects an operational report that violates the Pilot performance budget", () => {
  const report = {
    scenarios: {
      login: { errors: 0, p95Ms: 501 },
      equipment: { errors: 0, p95Ms: 10 },
      booking: { errors: 0, p95Ms: 10 },
      dashboard: { errors: 0, p95Ms: 10 }
    }
  };
  assert.throws(
    () => assertPerformanceBudget(report),
    /login p95 501ms exceeds 500ms/
  );
});

test("accepts an operational report inside the Pilot performance budget", () => {
  const report = {
    scenarios: {
      login: { errors: 0, p95Ms: 100 },
      equipment: { errors: 0, p95Ms: 100 },
      booking: { errors: 0, p95Ms: 100 },
      dashboard: { errors: 0, p95Ms: 100 }
    }
  };
  assert.equal(assertPerformanceBudget(report), true);
});
