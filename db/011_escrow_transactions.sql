CREATE TABLE IF NOT EXISTS escrow_transactions (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  payer_id TEXT NOT NULL,
  payee_id TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('locked', 'approved', 'released')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS escrow_reference_idx
  ON escrow_transactions (tenant_id, reference_id);

ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escrow_tenant_isolation ON escrow_transactions;
CREATE POLICY escrow_tenant_isolation ON escrow_transactions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
