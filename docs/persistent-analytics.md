# Persistent Analytics Projection

The Outbox Worker now projects each successfully published domain event to
ClickHouse before marking the PostgreSQL outbox row as `published`.

The Pilot KPI endpoint reads from ClickHouse when the analytics sink is
configured. Its aggregation groups by `event_id`, so a repeated delivery does
not double-count bookings, utilization, R&D spend, or economic output.

Required worker settings:

```env
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_USER=stp_app
CLICKHOUSE_PASSWORD=change-me-clickhouse
CLICKHOUSE_DATABASE=stp_os
```

The live integration path can be verified with:

```powershell
$env:RUN_INTEGRATION = "true"
node --test test/docker-integration.test.js
```
