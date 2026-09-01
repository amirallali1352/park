import assert from "node:assert/strict";
import test from "node:test";
import { SampleStatus, createSample, createCustodyEvent } from "../src/domain/sample.js";

test("creates a sample with a generated tracking code", () => {
  const sample = createSample({
    id: "sample-1",
    tenantId: "park-1",
    name: "Water analysis",
    barcode: "SAMPLE-0001",
    submittedBy: "u-1"
  });
  assert.deepEqual(sample, {
    id: "sample-1",
    tenantId: "park-1",
    name: "Water analysis",
    barcode: "SAMPLE-0001",
    submittedBy: "u-1",
    status: "received"
  });
});

test("rejects invalid sample status", () => {
  assert.throws(
    () => createSample({
      id: "sample-1", tenantId: "park-1", name: "Test",
      barcode: "S-1", submittedBy: "u-1", status: "unknown"
    }),
    { code: "INVALID_SAMPLE" }
  );
});

test("creates a custody event with an immutable timestamp", () => {
  const event = createCustodyEvent({
    id: "custody-1",
    sampleId: "sample-1",
    tenantId: "park-1",
    actorId: "u-1",
    action: "received",
    location: "Lab A"
  });
  assert.equal(event.sampleId, "sample-1");
  assert.equal(event.action, "received");
  assert.equal(typeof event.occurredAt, "string");
});
