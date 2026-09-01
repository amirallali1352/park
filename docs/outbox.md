# Transactional Outbox

The platform records domain events in `outbox_events` for reliable asynchronous
delivery to Kafka or Redpanda.

Supported events:

- `BookingConfirmed`
- `SampleReceived`
- `MaintenanceScheduled`
- `EscrowCreated`
- `EscrowApproved`
- `EscrowReleased`
- `VoucherIssued`
- `VoucherApplied`

Events start with `pending` status and can later be marked `published` by a
worker. The table is tenant-isolated with PostgreSQL RLS.

All event-producing write paths use `PostgresUnitOfWork` when the production
repository is enabled. The aggregate write and the outbox insert run on the
same PostgreSQL transaction and the same tenant context; a failure rolls back
both. This covers bookings, maintenance, sample custody receipt, escrow
lifecycle, and voucher lifecycle operations. In-memory repositories retain a
deterministic sequential fallback for unit tests.

Migration: `db/005_outbox.sql`
