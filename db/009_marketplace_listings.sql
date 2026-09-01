CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('tech_offer', 'tech_request', 'rd_request', 'business_offer')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  capabilities JSONB NOT NULL,
  tags JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS marketplace_listing_filter_idx
  ON marketplace_listings (tenant_id, type, status, created_at);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_listings_tenant_isolation ON marketplace_listings;
CREATE POLICY marketplace_listings_tenant_isolation ON marketplace_listings
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
