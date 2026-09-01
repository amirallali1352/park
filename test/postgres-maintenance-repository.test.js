import assert from "node:assert/strict";
import test from "node:test";
import { createMaintenanceWindow } from "../src/domain/facility.js";
import { PostgresFacilityRepository } from "../src/infrastructure/postgres-facility-repository.js";

test("writes maintenance using a PostgreSQL time range", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO equipment_maintenance")) {
        return { rows: [{
          id: values[0], tenant_id: values[1], equipment_id: values[2],
          maintenance_type: values[3], start_at: values[4], end_at: values[5],
          notes: values[6], status: values[7]
        }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresFacilityRepository(client);
  const window = createMaintenanceWindow({
    id: "m-1", tenantId: "park-1", equipmentId: "eq-1",
    type: "calibration", startAt: "2026-09-05T10:00:00Z",
    endAt: "2026-09-05T12:00:00Z", notes: "Annual"
  });
  assert.deepEqual(await repository.saveMaintenance(window), window);
  assert.ok(calls[1].text.includes("tstzrange($5, $6, '[)')"));
});
