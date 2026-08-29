import assert from "node:assert/strict";
import test from "node:test";
import { AccessModel, createBooking, createEquipment } from "../src/domain/facility.js";
import { InMemoryFacilityRepository } from "../src/infrastructure/in-memory-facility-repository.js";

test("isolates equipment and bookings by tenant", async () => {
  const repository = new InMemoryFacilityRepository();
  const equipment = createEquipment({
    id: "eq-1", tenantId: "park-1", name: "SEM", type: "sem",
    accessModel: AccessModel.OPERATOR_ASSISTED
  });
  repository.saveEquipment(equipment);
  repository.saveEquipment(createEquipment({
    id: "eq-2", tenantId: "park-2", name: "GC-MS", type: "gc_ms",
    accessModel: AccessModel.CERTIFIED_SELF_SERVICE
  }));

  assert.deepEqual((await repository.listEquipment("park-1")).map((item) => item.id), ["eq-1"]);
});

test("rejects overlapping bookings for the same equipment", async () => {
  const repository = new InMemoryFacilityRepository();
  await repository.saveEquipment(createEquipment({
    id: "eq-1", tenantId: "park-1", name: "SEM", type: "sem",
    accessModel: AccessModel.OPERATOR_ASSISTED
  }));
  const booking = createBooking({
    id: "b-1", tenantId: "park-1", equipmentId: "eq-1", userId: "u-1",
    startAt: "2026-09-01T10:00:00Z", endAt: "2026-09-01T11:00:00Z"
  });
  await repository.saveBooking(booking);

  await assert.rejects(
    () => repository.saveBooking(createBooking({
      id: "b-2", tenantId: "park-1", equipmentId: "eq-1", userId: "u-2",
      startAt: "2026-09-01T10:30:00Z", endAt: "2026-09-01T11:30:00Z"
    })),
    { code: "BOOKING_CONFLICT" }
  );
});
