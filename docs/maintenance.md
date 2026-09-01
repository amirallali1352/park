# Equipment maintenance

The Core Facility module supports scheduled calibration and maintenance windows.

API:

- `POST /api/v1/equipment/:equipmentId/maintenance`
- `GET /api/v1/equipment/:equipmentId/maintenance`

Bookings that overlap a scheduled maintenance window are rejected with
`409 MAINTENANCE_CONFLICT`. This is enforced in the in-memory repository and
in the PostgreSQL repository inside the booking transaction.

Migration: `db/004_maintenance.sql`
