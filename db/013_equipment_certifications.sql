CREATE TABLE IF NOT EXISTS equipment_certifications (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS equipment_certifications_lookup_idx
  ON equipment_certifications (tenant_id, equipment_id, user_id, expires_at);

ALTER TABLE equipment_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_certifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS equipment_certifications_tenant_isolation ON equipment_certifications;
CREATE POLICY equipment_certifications_tenant_isolation ON equipment_certifications
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
