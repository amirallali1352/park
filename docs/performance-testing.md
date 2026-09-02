# Pilot Performance Smoke Test

Run the API first with `npm start`, then execute:

```powershell
$env:PERF_TOTAL = "100"
$env:PERF_CONCURRENCY = "10"
npm run perf:smoke
```

The tool measures `/health`, `/metrics`, and concurrent PostgreSQL `SELECT 1`
operations. It reports request count, errors, minimum, maximum, average, p50,
and p95 latency.

Pilot acceptance targets are zero errors, API p95 below 500 ms, and PostgreSQL
p95 below 200 ms for this smoke profile. These are baseline checks, not a
replacement for a long-running load test or capacity plan.
