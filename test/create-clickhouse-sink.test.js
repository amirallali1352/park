import assert from "node:assert/strict";
import test from "node:test";
import { createClickHouseSink } from "../src/analytics/create-clickhouse-sink.js";

test("creates a ClickHouse analytics sink from configuration", () => {
  const sink = createClickHouseSink({ url: "http://127.0.0.1:8123" });
  assert.equal(sink.table, "stp_events");
  assert.equal(typeof sink.write, "function");
});

test("requires a ClickHouse URL", () => {
  assert.throws(() => createClickHouseSink({}), /CLICKHOUSE_URL/);
});
