# Pilot MVP

The first Pilot slice provides one end-to-end workflow for a technology park:

- tenant-scoped equipment, booking, and sample counts;
- tenant KPI aggregation for bookings, utilization, and R&D spend;
- a browser dashboard at `GET /pilot/dashboard`;
- a JSON summary at `GET /api/v1/pilot/summary`;
- real PostgreSQL transactional-outbox verification;
- real ClickHouse analytics insertion/query verification;
- real OpenSearch vector indexing and tenant-filtered search verification.

## Run locally

Start the platform dependencies:

```powershell
docker compose up -d postgres redpanda minio opensearch clickhouse
```

Run the API in memory mode for a quick UI smoke test:

```powershell
npm.cmd start
```

Open `http://127.0.0.1:3000/pilot/dashboard` and enter a tenant ID.

For the production repository and analytics adapters:

```powershell
$env:DATABASE_URL = "postgres://stp_os:change-me@127.0.0.1:15432/stp_os"
$env:OPENSEARCH_NODE = "http://127.0.0.1:9200"
$env:CLICKHOUSE_URL = "http://127.0.0.1:8123"
$env:CLICKHOUSE_USER = "stp_app"
$env:CLICKHOUSE_PASSWORD = "change-me-clickhouse"
npm.cmd start
```

## Integration test

The Docker integration test is opt-in because it writes temporary records to
the local development services:

```powershell
$env:RUN_INTEGRATION = "true"
node --test test/docker-integration.test.js
```

The test creates a temporary tenant, verifies commit and rollback behavior,
writes one ClickHouse event, and confirms OpenSearch results cannot cross the
tenant boundary. It removes its temporary PostgreSQL and OpenSearch data.
