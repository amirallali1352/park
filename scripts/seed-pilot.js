const baseUrl = process.env.PILOT_API_URL ?? "http://127.0.0.1:3000";
const tenantId = process.env.PILOT_TENANT_ID ?? "pilot-park-1";

async function request(path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok && response.status !== 409) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return { response, data };
}

async function seed() {
  const tenantHeaders = { "x-tenant-id": tenantId };
  await request("/api/v1/tenants", {
    id: tenantId,
    name: "STP OS Pilot Technology Park",
    type: "park"
  });
  await request("/api/v1/users", {
    id: "pilot-admin-1",
    email: "pilot.admin@stp-os.local",
    password: process.env.PILOT_ADMIN_PASSWORD ?? "Pilot@2026!X",
    role: "park_admin"
  }, tenantHeaders);

  for (const equipment of [
    { id: "pilot-hplc-1", name: "Pilot HPLC", type: "hplc", accessModel: "operator_assisted" },
    { id: "pilot-sem-1", name: "Pilot SEM", type: "sem", accessModel: "certified_self_service" },
    { id: "pilot-gcms-1", name: "Pilot GC-MS", type: "gc_ms", accessModel: "operator_assisted" }
  ]) {
    await request("/api/v1/equipment", equipment, tenantHeaders);
  }

  await request("/api/v1/samples", {
    id: "pilot-sample-1",
    name: "Pilot Water Sample",
    barcode: "PILOT-SAMPLE-001",
    submittedBy: "pilot-admin-1"
  }, tenantHeaders);
  await request("/api/v1/samples/pilot-sample-1/custody", {
    id: "pilot-custody-1",
    actorId: "pilot-admin-1",
    action: "received",
    location: "Pilot Lab A"
  }, tenantHeaders);

  await request("/api/v1/bookings", {
    id: "pilot-booking-1",
    equipmentId: "pilot-hplc-1",
    userId: "pilot-admin-1",
    startAt: "2026-09-02T10:00:00.000Z",
    endAt: "2026-09-02T12:00:00.000Z",
    amount: 450
  }, tenantHeaders);

  console.log(JSON.stringify({
    tenantId,
    adminEmail: "pilot.admin@stp-os.local",
    adminPassword: process.env.PILOT_ADMIN_PASSWORD ?? "Pilot@2026!X",
    dashboard: `${baseUrl}/pilot/dashboard`
  }, null, 2));
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
