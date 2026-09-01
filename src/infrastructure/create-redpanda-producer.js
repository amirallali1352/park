export function createRedpandaProducer({
  Kafka,
  brokers = (process.env.KAFKA_BROKERS ?? "127.0.0.1:19092")
    .split(",").map((broker) => broker.trim()).filter(Boolean),
  clientId = process.env.KAFKA_CLIENT_ID ?? "stp-os-worker"
} = {}) {
  if (typeof Kafka !== "function") {
    throw new TypeError("A Kafka constructor is required.");
  }
  if (brokers.length === 0) {
    throw new TypeError("At least one Kafka broker is required.");
  }
  const kafka = new Kafka({ clientId, brokers });
  return kafka.producer({ idempotent: true, maxInFlightRequests: 1 });
}
