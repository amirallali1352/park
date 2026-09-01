import { Kafka } from "kafkajs";
import { createProductionRepository } from "./infrastructure/production-repository.js";
import { createRedpandaProducer } from "./infrastructure/create-redpanda-producer.js";
import { RedpandaEventBus } from "./infrastructure/redpanda-event-bus.js";
import { OutboxWorker } from "./infrastructure/outbox-worker.js";

const intervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000);
const repositories = createProductionRepository();
const producer = createRedpandaProducer({ Kafka });
const eventBus = new RedpandaEventBus(producer);
const worker = new OutboxWorker({
  outboxRepository: repositories.outbox,
  eventBus,
  batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 100)
});

let running = true;
async function poll() {
  if (!running) return;
  try {
    const result = await worker.runOnce();
    if (result.scanned > 0) console.log("Outbox poll completed", result);
  } catch (error) {
    console.error("Outbox poll failed", error);
  }
}

await producer.connect();
console.log(`STP OS Outbox Worker connected to Redpanda (poll ${intervalMs}ms)`);
await poll();
const timer = setInterval(poll, intervalMs);

async function shutdown(signal) {
  running = false;
  clearInterval(timer);
  await producer.disconnect();
  await repositories.outbox.close?.();
  console.log(`Outbox Worker stopped (${signal})`);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
