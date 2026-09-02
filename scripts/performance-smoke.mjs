import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Pool } from "pg";

export function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
}

export function summarizeLatencies(latencies, errors = 0) {
  const rounded = (value) => Math.round(value * 100) / 100;
  return {
    count: latencies.length,
    errors,
    minMs: rounded(Math.min(...latencies)),
    maxMs: rounded(Math.max(...latencies)),
    avgMs: rounded(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
    p50Ms: rounded(percentile(latencies, 0.5)),
    p95Ms: rounded(percentile(latencies, 0.95))
  };
}

export function createLoadPlan(total, concurrency) {
  if (total <= 0) throw new Error("total must be positive");
  if (concurrency <= 0) throw new Error("concurrency must be positive");
  const plan = [];
  let remaining = total;
  while (remaining > 0) {
    const batch = Math.min(concurrency, remaining);
    plan.push(batch);
    remaining -= batch;
  }
  return plan;
}

async function runHttpLoad({ baseUrl, path, total, concurrency }) {
  const latencies = [];
  let errors = 0;
  for (const batchSize of createLoadPlan(total, concurrency)) {
    const results = await Promise.all(Array.from({ length: batchSize }, async () => {
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`);
        if (!response.ok) errors += 1;
      } catch {
        errors += 1;
      } finally {
        latencies.push(performance.now() - started);
      }
    }));
    void results;
  }
  return summarizeLatencies(latencies, errors);
}

async function runPostgresLoad({ connectionString, total, concurrency }) {
  const pool = new Pool({ connectionString, max: concurrency });
  const latencies = [];
  let errors = 0;
  try {
    for (const batchSize of createLoadPlan(total, concurrency)) {
      await Promise.all(Array.from({ length: batchSize }, async () => {
        const started = performance.now();
        try {
          await pool.query("SELECT 1");
        } catch {
          errors += 1;
        } finally {
          latencies.push(performance.now() - started);
        }
      }));
    }
  } finally {
    await pool.end();
  }
  return summarizeLatencies(latencies, errors);
}

async function main() {
  const total = Number(process.env.PERF_TOTAL ?? 100);
  const concurrency = Number(process.env.PERF_CONCURRENCY ?? 10);
  const baseUrl = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000";
  const connectionString = process.env.DATABASE_URL ?? "postgres://stp_os:change-me@127.0.0.1:15432/stp_os";
  const report = {
    generatedAt: new Date().toISOString(),
    configuration: { total, concurrency, baseUrl },
    api: {
      health: await runHttpLoad({ baseUrl, path: "/health", total, concurrency }),
      metrics: await runHttpLoad({ baseUrl, path: "/metrics", total, concurrency })
    },
    postgres: await runPostgresLoad({ connectionString, total, concurrency })
  };
  console.log(JSON.stringify(report, null, 2));
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
