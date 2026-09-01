CREATE TABLE IF NOT EXISTS consortia (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  request_id TEXT NOT NULL,
  grant_program TEXT NOT NULL,
  members JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE consortia ENABLE ROW LEVEL SECURITY;
ALTER TABLE consortia FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consortia_tenant_isolation ON consortia;
CREATE POLICY consortia_tenant_isolation ON consortia
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
