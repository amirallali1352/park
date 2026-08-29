import { FacilityError } from "../domain/facility.js";

function mapEquipment(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    type: row.type,
    accessModel: row.access_model,
    status: row.status
  };
}

function mapBooking(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    equipmentId: row.equipment_id,
    userId: row.user_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    status: row.status
  };
}

export class PostgresFacilityRepository {
  #client;

  constructor(client) {
    if (!client || (typeof client.query !== "function" && typeof client.connect !== "function")) {
      throw new TypeError("A PostgreSQL client with a query method is required.");
    }
    this.#client = client;
  }

  async #withTenantContext(tenantId, work) {
    if (typeof this.#client.connect !== "function") {
      await this.#client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      return work(this.#client);
    }
    const client = await this.#client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveEquipment(equipment) {
    const result = await this.#withTenantContext(equipment.tenantId, (client) => client.query(
      "INSERT INTO equipment (id, tenant_id, name, type, access_model, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, access_model = EXCLUDED.access_model, status = EXCLUDED.status RETURNING id, tenant_id, name, type, access_model, status",
      [equipment.id, equipment.tenantId, equipment.name, equipment.type, equipment.accessModel, equipment.status]
    ));
    return mapEquipment(result.rows[0]);
  }

  async listEquipment(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT id, tenant_id, name, type, access_model, status FROM equipment ORDER BY id"
    ));
    return result.rows.map(mapEquipment);
  }

  async saveBooking(booking) {
    try {
      const result = await this.#withTenantContext(booking.tenantId, (client) => client.query(
        "INSERT INTO bookings (id, tenant_id, equipment_id, user_id, time_range, status) VALUES ($1, $2, $3, $4, tstzrange($5, $6, '[)'), $7) RETURNING id, tenant_id, equipment_id, user_id, lower(time_range) AS start_at, upper(time_range) AS end_at, status",
        [booking.id, booking.tenantId, booking.equipmentId, booking.userId, booking.startAt, booking.endAt, booking.status]
      ));
      return mapBooking(result.rows[0]);
    } catch (error) {
      if (error.code === "23P01") {
        throw new FacilityError(
          "Equipment is already booked for this time range.",
          "BOOKING_CONFLICT"
        );
      }
      throw error;
    }
  }

  async listBookings(tenantId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT id, tenant_id, equipment_id, user_id, lower(time_range) AS start_at, upper(time_range) AS end_at, status FROM bookings ORDER BY lower(time_range)"
    ));
    return result.rows.map(mapBooking);
  }
}
