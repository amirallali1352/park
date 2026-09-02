import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createLoadPlan, percentile } from "./performance-smoke.mjs";

export function operationalScenarioNames() {
  return ["login", "equipment", "booking", "dashboard"];
}

export function buildBookingPayload(tenantId, equipmentId, userId, index) {
  const start = new Date(Date.UTC(2026, 8, 3, 10, 0, 0) + index * 30 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    id: `${tenantId}-load-booking-${index}`,
    equipmentId,
    userId,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    amount: 100
  };
}

export function summarizeScenario(latencies, errors = 0) {
  const rounded = (value) => Math.round(value * 100) / 100;
  return {
    count: latencies.length,
    errors,
    successRate: rounded(((latencies.length - errors) / latencies.length) * 100),
    minMs: rounded(Math.min(...latencies)),
    maxMs: rounded(Math.max(...latencies)),
    avgMs: rounded(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
    p50Ms: rounded(percentile(latencies, 0.5)),
    p95Ms: rounded(percentile(latencies, 0.95))
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function runScenario(total, concurrency, operation) {
  const latencies = [];
  let errors = 0;
  let index = 0;
  for (const batchSize of createLoadPlan(total, concurrency)) {
    await Promise.all(Array.from({ length: batchSize }, async () => {
      const current = index++;
      const started = performance.now();
      try {
        if (!(await operation(current))) errors += 1;
      } catch {
        errors += 1;
      } finally {
        latencies.push(performance.now() - started);
      }
    }));
  }
  return summarizeScenario(latencies, errors);
}

async function main() {
  const baseUrl = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000";
  const total = Number(process.env.OPERATIONS_TOTAL ?? 50);
  const concurrency = Number(process.env.OPERATIONS_CONCURRENCY ?? 5);
  const suffix = Date.now();
  const tenantId = `pilot-load-${suffix}`;
  const userId = `${tenantId}-admin`;
  const equipmentId = `${tenantId}-hplc`;
  const email = `${tenantId}@stp-os.local`;
  const password = "PilotLoad@2026!";
  const tenantHeaders = { "x-tenant-id": tenantId };

  await requestJson(baseUrl, "/api/v1/tenants", {
    method: "POST", body: JSON.stringify({ id: tenantId, name: "Performance Pilot", type: "park" })
  });
  await requestJson(baseUrl, "/api/v1/users", {
    method: "POST",
    headers: tenantHeaders,
    body: JSON.stringify({ id: userId, email, password, role: "park_admin" })
  });
  await requestJson(baseUrl, "/api/v1/equipment", {
    method: "POST",
    headers: tenantHeaders,
    body: JSON.stringify({ id: equipmentId, name: "Load HPLC", type: "hplc", accessModel: "operator_assisted" })
  });

  const report = {
    generatedAt: new Date().toISOString(),
    configuration: { baseUrl, total, concurrency, tenantId },
    scenarios: {}
  };

  report.scenarios.login = await runScenario(total, concurrency, async () => {
    const { response, body } = await requestJson(baseUrl, "/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, tenantId })
    });
    return response.ok && typeof body?.accessToken === "string";
  });

  const login = await requestJson(baseUrl, "/api/v1/auth/login", {
    method: "POST", body: JSON.stringify({ email, password, tenantId })
  });
  const accessToken = login.body.accessToken;
  const authHeaders = { ...tenantHeaders, authorization: `Bearer ${accessToken}` };

  report.scenarios.equipment = await runScenario(total, concurrency, async () => {
    const { response } = await requestJson(baseUrl, "/api/v1/equipment", { headers: authHeaders });
    return response.ok;
  });

  report.scenarios.booking = await runScenario(total, concurrency, async (index) => {
    const { response } = await requestJson(baseUrl, "/api/v1/bookings", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(buildBookingPayload(tenantId, equipmentId, userId, index))
    });
    return response.status === 201;
  });

  report.scenarios.dashboard = await runScenario(total, concurrency, async () => {
    const { response } = await requestJson(baseUrl, "/api/v1/pilot/summary", { headers: authHeaders });
    return response.ok;
  });

  console.log(JSON.stringify(report, null, 2));
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
