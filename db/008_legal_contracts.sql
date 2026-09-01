CREATE TABLE IF NOT EXISTS legal_contracts (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('mNDA', 'MSA')),
  title TEXT NOT NULL,
  parties JSONB NOT NULL,
  terms JSONB NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending_signatures', 'active')),
  signatures JSONB NOT NULL,
  document TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE legal_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contracts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_contracts_tenant_isolation ON legal_contracts;
CREATE POLICY legal_contracts_tenant_isolation ON legal_contracts
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
