import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessModel,
  FacilityError,
  createBooking,
  createEquipment
} from "../src/domain/facility.js";

test("creates equipment with a valid access model", () => {
  const equipment = createEquipment({
    id: "eq-1",
    tenantId: "park-1",
    name: "HPLC",
    type: "hplc",
    accessModel: AccessModel.CERTIFIED_SELF_SERVICE
  });
  assert.deepEqual(equipment, {
    id: "eq-1",
    tenantId: "park-1",
    name: "HPLC",
    type: "hplc",
    accessModel: "certified_self_service",
    status: "available"
  });
});

test("rejects invalid booking ranges", () => {
  assert.throws(
    () => createBooking({
      id: "booking-1",
      tenantId: "park-1",
      equipmentId: "eq-1",
      userId: "u-1",
      startAt: "2026-09-01T10:00:00Z",
      endAt: "2026-09-01T10:00:00Z"
    }),
    (error) => error instanceof FacilityError && error.code === "INVALID_BOOKING_RANGE"
  );
});

test("normalizes booking dates to ISO strings", () => {
  const booking = createBooking({
    id: "booking-1",
    tenantId: "park-1",
    equipmentId: "eq-1",
    userId: "u-1",
    startAt: "2026-09-01T10:00:00Z",
    endAt: "2026-09-01T11:00:00Z"
  });
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.startAt, "2026-09-01T10:00:00.000Z");
});
