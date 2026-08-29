export const AccessModel = Object.freeze({
  OPERATOR_ASSISTED: "operator_assisted",
  CERTIFIED_SELF_SERVICE: "certified_self_service"
});

export class FacilityError extends Error {
  constructor(message, code = "FACILITY_ERROR") {
    super(message);
    this.name = "FacilityError";
    this.code = code;
  }
}

export function createEquipment({ id, tenantId, name, type, accessModel, status = "available" }) {
  if (!id || !tenantId || !name || !type || !Object.values(AccessModel).includes(accessModel)) {
    throw new FacilityError(
      "Equipment id, tenantId, name, type and a valid access model are required.",
      "INVALID_EQUIPMENT"
    );
  }
  return Object.freeze({ id, tenantId, name, type, accessModel, status });
}

export function createBooking({ id, tenantId, equipmentId, userId, startAt, endAt }) {
  if (!id || !tenantId || !equipmentId || !userId || !startAt || !endAt) {
    throw new FacilityError("Booking fields are required.", "INVALID_BOOKING");
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new FacilityError("Booking startAt must be before endAt.", "INVALID_BOOKING_RANGE");
  }
  return Object.freeze({
    id,
    tenantId,
    equipmentId,
    userId,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status: "confirmed"
  });
}

export function bookingOverlaps(left, right) {
  return left.startAt < right.endAt && right.startAt < left.endAt;
}
