CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  event_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published')),
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON outbox_events (status, occurred_at)
  WHERE status = 'pending';

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_tenant_isolation ON outbox_events;
CREATE POLICY outbox_tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
