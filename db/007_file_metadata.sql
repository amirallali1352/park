CREATE TABLE IF NOT EXISTS file_metadata (
  object_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  envelope_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, object_id),
  UNIQUE (bucket, storage_key)
);

ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_metadata FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS file_metadata_tenant_isolation ON file_metadata;
CREATE POLICY file_metadata_tenant_isolation ON file_metadata
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
