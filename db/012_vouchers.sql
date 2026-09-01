CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  beneficiary_id TEXT NOT NULL,
  program TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
  redeemed_amount NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (redeemed_amount >= 0 AND redeemed_amount <= amount),
  status TEXT NOT NULL CHECK (status IN ('active', 'redeemed')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vouchers_tenant_isolation ON vouchers;
CREATE POLICY vouchers_tenant_isolation ON vouchers
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
