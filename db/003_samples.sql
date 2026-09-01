CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  submitted_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('received', 'in_analysis', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS sample_custody_events (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL REFERENCES samples(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  location TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS samples_tenant_id_idx ON samples (tenant_id);
CREATE INDEX IF NOT EXISTS custody_sample_id_idx ON sample_custody_events (sample_id, occurred_at);

ALTER TABLE samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE samples FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS samples_tenant_isolation ON samples;
CREATE POLICY samples_tenant_isolation ON samples
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE sample_custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_custody_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custody_tenant_isolation ON sample_custody_events;
CREATE POLICY custody_tenant_isolation ON sample_custody_events
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
