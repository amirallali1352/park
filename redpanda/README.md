# Redpanda development profile

The application exposes an event-bus interface and an outbox worker. The
`RedpandaEventBus` adapter is ready for a Kafka-compatible producer.

The worker contract is:

1. read pending events in bounded batches;
2. publish each event to the topic named after its type;
3. mark the event as published only after the broker confirms success;
4. leave failed events pending for retry.
