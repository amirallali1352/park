CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('calibration', 'maintenance')),
  time_range TSTZRANGE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_maintenance_tenant_idx ON equipment_maintenance (tenant_id);

ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS maintenance_tenant_isolation ON equipment_maintenance;
CREATE POLICY maintenance_tenant_isolation ON equipment_maintenance
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE equipment_maintenance
  DROP CONSTRAINT IF EXISTS maintenance_equipment_time_no_overlap;
ALTER TABLE equipment_maintenance
  ADD CONSTRAINT maintenance_equipment_time_no_overlap
  EXCLUDE USING gist (equipment_id WITH =, time_range WITH &&)
  WHERE (status = 'scheduled');
