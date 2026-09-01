import assert from "node:assert/strict";
import test from "node:test";
import { createRedpandaProducer } from "../src/infrastructure/create-redpanda-producer.js";

test("creates an idempotent Redpanda producer", () => {
  let options;
  const producer = { connect() {}, send() {} };
  const fakeKafka = class {
    constructor(value) {
      options = value;
    }
    producer(value) {
      assert.deepEqual(value, { idempotent: true, maxInFlightRequests: 1 });
      return producer;
    }
  };

  assert.equal(createRedpandaProducer({
    Kafka: fakeKafka,
    brokers: ["redpanda:9092"],
    clientId: "stp-os-worker"
  }), producer);
  assert.deepEqual(options, {
    clientId: "stp-os-worker",
    brokers: ["redpanda:9092"]
  });
});
