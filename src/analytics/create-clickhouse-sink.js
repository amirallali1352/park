import { createClient } from "@clickhouse/client";
import { ClickHouseAnalyticsSink } from "./clickhouse-sink.js";

export function createClickHouseSink({
  url = process.env.CLICKHOUSE_URL,
  username = process.env.CLICKHOUSE_USER ?? "default",
  password = process.env.CLICKHOUSE_PASSWORD ?? "",
  database = process.env.CLICKHOUSE_DATABASE ?? "stp_os",
  table = process.env.CLICKHOUSE_EVENTS_TABLE ?? "stp_events"
} = {}) {
  if (!url) throw new Error("CLICKHOUSE_URL is required.");
  return new ClickHouseAnalyticsSink({
    client: createClient({ url, username, password, database }),
    table
  });
}
