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

For the authenticated operational flow, start the API in memory mode and run:

```powershell
$env:OPERATIONS_TOTAL = "50"
$env:OPERATIONS_CONCURRENCY = "5"
npm run perf:operations
```

This bootstraps an isolated tenant and measures login, equipment listing,
booking creation, and the Pilot dashboard summary.
