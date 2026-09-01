import assert from "node:assert/strict";
import test from "node:test";
import { AccessModel, createBooking, createEquipment, createMaintenanceWindow } from "../src/domain/facility.js";
import { InMemoryFacilityRepository } from "../src/infrastructure/in-memory-facility-repository.js";

test("rejects bookings that overlap scheduled maintenance", async () => {
  const repository = new InMemoryFacilityRepository();
  await repository.saveEquipment(createEquipment({
    id: "eq-1", tenantId: "park-1", name: "HPLC", type: "hplc",
    accessModel: AccessModel.OPERATOR_ASSISTED
  }));
  await repository.saveMaintenance(createMaintenanceWindow({
    id: "m-1", tenantId: "park-1", equipmentId: "eq-1", type: "maintenance",
    startAt: "2026-09-05T10:00:00Z", endAt: "2026-09-05T12:00:00Z"
  }));

  await assert.rejects(
    () => repository.saveBooking(createBooking({
      id: "b-1", tenantId: "park-1", equipmentId: "eq-1", userId: "u-1",
      startAt: "2026-09-05T11:00:00Z", endAt: "2026-09-05T11:30:00Z"
    })),
    { code: "MAINTENANCE_CONFLICT" }
  );
});
