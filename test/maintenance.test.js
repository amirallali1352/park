import assert from "node:assert/strict";
import test from "node:test";
import { createMaintenanceWindow } from "../src/domain/facility.js";

test("creates a calibration maintenance window", () => {
  const window = createMaintenanceWindow({
    id: "maintenance-1",
    tenantId: "park-1",
    equipmentId: "eq-1",
    type: "calibration",
    startAt: "2026-09-05T10:00:00Z",
    endAt: "2026-09-05T12:00:00Z",
    notes: "Annual calibration"
  });
  assert.deepEqual(window, {
    id: "maintenance-1",
    tenantId: "park-1",
    equipmentId: "eq-1",
    type: "calibration",
    startAt: "2026-09-05T10:00:00.000Z",
    endAt: "2026-09-05T12:00:00.000Z",
    notes: "Annual calibration",
    status: "scheduled"
  });
});

test("rejects an invalid maintenance type", () => {
  assert.throws(
    () => createMaintenanceWindow({
      id: "maintenance-1", tenantId: "park-1", equipmentId: "eq-1",
      type: "unknown", startAt: "2026-09-05T10:00:00Z", endAt: "2026-09-05T12:00:00Z"
    }),
    { code: "INVALID_MAINTENANCE" }
  );
});
