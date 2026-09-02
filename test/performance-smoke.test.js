import test from "node:test";
import assert from "node:assert/strict";
import { percentile, summarizeLatencies, createLoadPlan } from "../scripts/performance-smoke.mjs";

test("calculates deterministic latency percentiles", () => {
  const values = [10, 20, 30, 40, 50];
  assert.equal(percentile(values, 0.5), 30);
  assert.equal(percentile(values, 0.95), 50);
});

test("summarizes successful and failed performance samples", () => {
  assert.deepEqual(
    summarizeLatencies([10, 20, 30, 40], 1),
    {
      count: 4,
      errors: 1,
      minMs: 10,
      maxMs: 40,
      avgMs: 25,
      p50Ms: 20,
      p95Ms: 40
    }
  );
});

test("creates bounded concurrent load plans", () => {
  assert.deepEqual(createLoadPlan(10, 3), [3, 3, 3, 1]);
  assert.deepEqual(createLoadPlan(2, 5), [2]);
  assert.throws(() => createLoadPlan(0, 2), /total must be positive/);
});
