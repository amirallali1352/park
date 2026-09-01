# Cryptographic audit trail

The audit module creates a SHA-256 hash chain per Tenant. Each event contains
the hash of the previous event and its own calculated hash.

API:

- `GET /api/v1/audit`

Audit events are append-only. The PostgreSQL migration enables RLS and adds a
trigger that rejects `UPDATE` and `DELETE`. The in-memory implementation also
rejects mutation operations.

The current chain covers:

- `booking.created`
- `sample.received`
- `maintenance.scheduled`

Migration: `db/006_audit.sql`
