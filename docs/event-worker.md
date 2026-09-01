# Outbox event worker

The outbox worker is implemented in `src/infrastructure/outbox-worker.js`.
It processes bounded batches and follows at-least-once delivery semantics:

1. read `pending` events;
2. publish each event to the Kafka-compatible topic named after its type;
3. mark an event `published` only after broker acknowledgement;
4. leave failed events pending for retry.

`RedpandaEventBus` is the Kafka-compatible adapter. Local Redpanda is available
in `docker-compose.yml` at `127.0.0.1:19092`; its admin API is available at
port `9644`.

The current worker abstraction is ready for a long-running process and retry
policy. A production worker should use a database role with the required
Outbox access and process one Tenant context at a time because Outbox is
protected by PostgreSQL RLS.
