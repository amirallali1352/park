# Transactional Outbox

The platform records domain events in `outbox_events` for reliable asynchronous
delivery to Kafka or Redpanda.

Supported events:

- `BookingConfirmed`
- `SampleReceived`
- `MaintenanceScheduled`

Events start with `pending` status and can later be marked `published` by a
worker. The table is tenant-isolated with PostgreSQL RLS. The current API
records the event after the aggregate operation succeeds; a future application
service will wrap aggregate persistence and outbox insertion in one database
transaction for strict transactional-outbox semantics.

Migration: `db/005_outbox.sql`
