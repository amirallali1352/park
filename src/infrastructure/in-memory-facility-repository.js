import { FacilityError, bookingOverlaps } from "../domain/facility.js";

export class InMemoryFacilityRepository {
  #equipment = new Map();
  #bookings = new Map();

  async saveEquipment(equipment) {
    this.#equipment.set(equipment.id, equipment);
    return equipment;
  }

  async listEquipment(tenantId) {
    return [...this.#equipment.values()].filter((item) => item.tenantId === tenantId);
  }

  async saveBooking(booking) {
    const equipment = this.#equipment.get(booking.equipmentId);
    if (!equipment || equipment.tenantId !== booking.tenantId) {
      throw new FacilityError("Equipment does not belong to this tenant.", "EQUIPMENT_ACCESS_DENIED");
    }
    const conflict = [...this.#bookings.values()].find(
      (candidate) =>
        candidate.tenantId === booking.tenantId &&
        candidate.equipmentId === booking.equipmentId &&
        bookingOverlaps(candidate, booking)
    );
    if (conflict) {
      throw new FacilityError(
        "Equipment is already booked for this time range.",
        "BOOKING_CONFLICT"
      );
    }
    this.#bookings.set(booking.id, booking);
    return booking;
  }

  async listBookings(tenantId) {
    return [...this.#bookings.values()].filter((booking) => booking.tenantId === tenantId);
  }
}
