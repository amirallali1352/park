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
    return this.saveBookingInTransaction(this.#client, booking, true);
  }

  async saveBookingInTransaction(client, booking, useTenantContext = false) {
    try {
      const run = (txClient) => txClient.query(
        "INSERT INTO bookings (id, tenant_id, equipment_id, user_id, time_range, status) SELECT $1, $2, $3, $4, tstzrange($5, $6, '[)'), $7 WHERE NOT EXISTS (SELECT 1 FROM equipment_maintenance WHERE tenant_id = $2 AND equipment_id = $3 AND status = 'scheduled' AND time_range && tstzrange($5, $6, '[)')) RETURNING id, tenant_id, equipment_id, user_id, lower(time_range) AS start_at, upper(time_range) AS end_at, status",
        [booking.id, booking.tenantId, booking.equipmentId, booking.userId, booking.startAt, booking.endAt, booking.status]
      );
      const result = useTenantContext
        ? await this.#withTenantContext(booking.tenantId, run)
        : await run(client);
      if (result.rows.length === 0) {
        throw new FacilityError(
          "Equipment is unavailable during scheduled maintenance.",
          "MAINTENANCE_CONFLICT"
        );
      }
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

  async saveMaintenance(window) {
    return this.saveMaintenanceInTransaction(this.#client, window, true);
  }

  async saveMaintenanceInTransaction(client, window, useTenantContext = false) {
    try {
      const run = (txClient) => txClient.query(
        "INSERT INTO equipment_maintenance (id, tenant_id, equipment_id, maintenance_type, time_range, notes, status) VALUES ($1, $2, $3, $4, tstzrange($5, $6, '[)'), $7, $8) RETURNING id, tenant_id, equipment_id, maintenance_type, lower(time_range) AS start_at, upper(time_range) AS end_at, notes, status",
        [window.id, window.tenantId, window.equipmentId, window.type, window.startAt, window.endAt, window.notes, window.status]
      );
      const result = useTenantContext
        ? await this.#withTenantContext(window.tenantId, run)
        : await run(client);
      const row = result.rows[0];
      return {
        id: row.id, tenantId: row.tenant_id, equipmentId: row.equipment_id,
        type: row.maintenance_type, startAt: new Date(row.start_at).toISOString(),
        endAt: new Date(row.end_at).toISOString(), notes: row.notes, status: row.status
      };
    } catch (error) {
      if (error.code === "23P01") {
        throw new FacilityError(
          "Equipment is already under maintenance for this time range.",
          "MAINTENANCE_CONFLICT"
        );
      }
      throw error;
    }
  }

  async listMaintenance(tenantId, equipmentId) {
    const result = await this.#withTenantContext(tenantId, (client) => client.query(
      "SELECT id, tenant_id, equipment_id, maintenance_type, lower(time_range) AS start_at, upper(time_range) AS end_at, notes, status FROM equipment_maintenance WHERE equipment_id = $1 ORDER BY lower(time_range)",
      [equipmentId]
    ));
    return result.rows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, equipmentId: row.equipment_id,
      type: row.maintenance_type, startAt: new Date(row.start_at).toISOString(),
      endAt: new Date(row.end_at).toISOString(), notes: row.notes, status: row.status
    }));
  }
}
