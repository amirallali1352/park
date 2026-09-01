CREATE DATABASE IF NOT EXISTS stp_os;

CREATE TABLE IF NOT EXISTS stp_os.stp_events
(
  event_id String,
  event_type LowCardinality(String),
  tenant_id String,
  occurred_at DateTime64(3, 'UTC'),
  payload String
)
ENGINE = MergeTree
ORDER BY (tenant_id, occurred_at, event_id);
