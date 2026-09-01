import assert from "node:assert/strict";
import test from "node:test";
import { AccessModel, createBooking, createEquipment } from "../src/domain/facility.js";
import { PostgresFacilityRepository } from "../src/infrastructure/postgres-facility-repository.js";

function clientMock() {
  const calls = [];
  return {
    calls,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("INSERT INTO equipment")) {
        return { rows: [{ id: values[0], tenant_id: values[1], name: values[2], type: values[3], access_model: values[4], status: "available" }] };
      }
      if (text.includes("INSERT INTO bookings")) {
        return { rows: [{ id: values[0], tenant_id: values[1], equipment_id: values[2], user_id: values[3], start_at: values[4], end_at: values[5], status: "confirmed" }] };
      }
      if (text.includes("SELECT id, tenant_id, name")) return { rows: [] };
      if (text.includes("SELECT id, tenant_id, equipment_id")) return { rows: [] };
      return { rows: [] };
    }
  };
}

test("writes equipment inside a tenant transaction", async () => {
  const client = clientMock();
  const repository = new PostgresFacilityRepository(client);
  const equipment = createEquipment({
    id: "eq-1", tenantId: "park-1", name: "HPLC", type: "hplc",
    accessModel: AccessModel.OPERATOR_ASSISTED
  });
  await repository.saveEquipment(equipment);
  assert.equal(client.calls[0].text, "SELECT set_config('app.tenant_id', $1, true)");
  assert.match(client.calls[1].text, /INSERT INTO equipment/);
});

test("uses a PostgreSQL range for booking overlap protection", async () => {
  const client = clientMock();
  const repository = new PostgresFacilityRepository(client);
  const booking = createBooking({
    id: "b-1", tenantId: "park-1", equipmentId: "eq-1", userId: "u-1",
    startAt: "2026-09-01T10:00:00Z", endAt: "2026-09-01T11:00:00Z"
  });
  await repository.saveBooking(booking);
  assert.ok(client.calls[1].text.includes("tstzrange($5, $6, '[)')"));
});

test("checks maintenance conflicts before inserting a booking", async () => {
  const calls = [];
  const client = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.trimStart().startsWith("SELECT") && text.includes("FROM equipment_maintenance")) {
        return { rows: [{ id: "maintenance-1" }] };
      }
      return { rows: [] };
    }
  };
  const repository = new PostgresFacilityRepository(client);
  await assert.rejects(
    () => repository.saveBooking({
      id: "b-1", tenantId: "park-1", equipmentId: "eq-1", userId: "u-1",
      startAt: "2026-09-05T11:00:00.000Z", endAt: "2026-09-05T11:30:00.000Z",
      status: "confirmed"
    }),
    { code: "MAINTENANCE_CONFLICT" }
  );
  assert.ok(calls.some((call) => call.text.includes("FROM equipment_maintenance")));
});

test("persists a booking through an injected transaction client", async () => {
  const client = clientMock();
  const repository = new PostgresFacilityRepository(client);
  const booking = createBooking({
    id: "b-tx", tenantId: "park-1", equipmentId: "eq-1", userId: "u-1",
    startAt: "2026-09-01T10:00:00Z", endAt: "2026-09-01T11:00:00Z"
  });
  await repository.saveBookingInTransaction(client, booking);
  assert.match(client.calls[0].text, /INSERT INTO bookings/);
});

test("persists maintenance through an injected transaction client", async () => {
  const client = {
    calls: [],
    async query(text, values) {
      this.calls.push({ text, values });
      return {
        rows: [{
          id: values[0], tenant_id: values[1], equipment_id: values[2],
          maintenance_type: values[3], start_at: values[4], end_at: values[5],
          notes: values[6], status: values[7]
        }]
      };
    }
  };
  const repository = new PostgresFacilityRepository(client);
  await repository.saveMaintenanceInTransaction(client, {
    id: "m-tx", tenantId: "park-1", equipmentId: "eq-1", type: "calibration",
    startAt: "2026-09-02T10:00:00Z", endAt: "2026-09-02T11:00:00Z",
    notes: "annual", status: "scheduled"
  });
  assert.match(client.calls[0].text, /INSERT INTO equipment_maintenance/);
});
