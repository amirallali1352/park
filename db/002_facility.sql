CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  access_model TEXT NOT NULL CHECK (access_model IN ('operator_assisted', 'certified_self_service')),
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  time_range TSTZRANGE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_tenant_id_idx ON equipment (tenant_id);
CREATE INDEX IF NOT EXISTS bookings_tenant_id_idx ON bookings (tenant_id);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS equipment_tenant_isolation ON equipment;
CREATE POLICY equipment_tenant_isolation ON equipment
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookings_tenant_isolation ON bookings;
CREATE POLICY bookings_tenant_isolation ON bookings
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_equipment_time_no_overlap;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_equipment_time_no_overlap
  EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&)
  WHERE (status = 'confirmed');
