import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import { createClient as createClickHouseClient } from "@clickhouse/client";
import { PostgresUnitOfWork } from "../src/infrastructure/postgres-unit-of-work.js";
import { ClickHouseAnalyticsSink } from "../src/analytics/clickhouse-sink.js";
import { OpenSearchVectorIndex } from "../src/search/opensearch-vector-index.js";

const runIntegration = process.env.RUN_INTEGRATION === "true";

test("runs the Pilot data path against Docker services", {
  skip: !runIntegration,
  timeout: 120_000
}, async () => {
  const tenantId = `integration-${randomUUID()}`;
  const equipmentId = randomUUID();
  const failedEquipmentId = randomUUID();
  const outboxId = randomUUID();
  const eventId = randomUUID();
  const indexName = `pilot-integration-${randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({
    connectionString: process.env.INTEGRATION_DATABASE_URL ??
      "postgres://stp_os:change-me@127.0.0.1:15432/stp_os"
  });
  const unitOfWork = new PostgresUnitOfWork(pool);
  const clickhouse = createClickHouseClient({
    url: process.env.INTEGRATION_CLICKHOUSE_URL ?? "http://127.0.0.1:8123",
    username: process.env.INTEGRATION_CLICKHOUSE_USER ?? "stp_app",
    password: process.env.INTEGRATION_CLICKHOUSE_PASSWORD ?? "change-me-clickhouse",
    database: "stp_os"
  });
  const opensearchClient = new OpenSearchClient({
    node: process.env.INTEGRATION_OPENSEARCH_NODE ?? "http://127.0.0.1:9200"
  });

  try {
    await pool.query("SELECT 1");
    await pool.query(
      "INSERT INTO tenants (id, name, type) VALUES ($1, $2, $3)",
      [tenantId, "Pilot Integration Park", "park"]
    );

    await unitOfWork.run(tenantId, async (client) => {
      await client.query(
        "INSERT INTO equipment (id, tenant_id, name, type, access_model, status) VALUES ($1, $2, $3, $4, $5, $6)",
        [equipmentId, tenantId, "Pilot HPLC", "hplc", "operator_assisted", "available"]
      );
      await client.query(
        "INSERT INTO outbox_events (id, tenant_id, event_type, aggregate_id, payload, occurred_at) VALUES ($1, $2, $3, $4, $5::jsonb, now())",
        [outboxId, tenantId, "EquipmentRegistered", equipmentId, JSON.stringify({ equipmentId })]
      );
    });

    const committed = await pool.query(
      "SELECT (SELECT count(*) FROM equipment WHERE id = $1) AS equipment_count, (SELECT count(*) FROM outbox_events WHERE id = $2) AS outbox_count",
      [equipmentId, outboxId]
    );
    assert.equal(Number(committed.rows[0].equipment_count), 1);
    assert.equal(Number(committed.rows[0].outbox_count), 1);

    await assert.rejects(() => unitOfWork.run(tenantId, async (client) => {
      await client.query(
        "INSERT INTO equipment (id, tenant_id, name, type, access_model, status) VALUES ($1, $2, $3, $4, $5, $6)",
        [failedEquipmentId, tenantId, "Rollback HPLC", "hplc", "operator_assisted", "available"]
      );
      throw new Error("pilot rollback probe");
    }), /pilot rollback probe/);
    const rolledBack = await pool.query(
      "SELECT count(*) FROM equipment WHERE id = $1", [failedEquipmentId]
    );
    assert.equal(Number(rolledBack.rows[0].count), 0);

    const analyticsSink = new ClickHouseAnalyticsSink({
      client: clickhouse,
      table: "stp_events"
    });
    await analyticsSink.write({
      id: eventId,
      type: "BookingConfirmed",
      tenantId,
      occurredAt: "2026-09-01T00:00:00.000Z",
      payload: { durationMinutes: 30, amount: 100 }
    });
    const analyticsResult = await clickhouse.query({
      query: "SELECT count() AS count FROM stp_events WHERE event_id = {eventId:String}",
      query_params: { eventId },
      format: "JSONEachRow"
    });
    assert.equal(Number((await analyticsResult.json())[0].count), 1);

    await opensearchClient.indices.create({
      index: indexName,
      body: {
        settings: { index: { knn: true, number_of_shards: 1, number_of_replicas: 0 } },
        mappings: {
          properties: {
            tenantId: { type: "keyword" },
            status: { type: "keyword" },
            embedding: { type: "knn_vector", dimension: 3 }
          }
        }
      }
    });
    const vectorIndex = new OpenSearchVectorIndex({
      client: opensearchClient,
      indexName
    });
    await vectorIndex.indexListing({
      id: "offer-target",
      tenantId,
      type: "tech_offer",
      title: "Pilot offer",
      summary: "Pilot",
      status: "open",
      embedding: [1, 0, 0]
    });
    await vectorIndex.indexListing({
      id: "offer-other",
      tenantId: "other-tenant",
      type: "tech_offer",
      title: "Other offer",
      summary: "Other",
      status: "open",
      embedding: [1, 0, 0]
    });
    const matches = await vectorIndex.search({ tenantId, embedding: [1, 0, 0], k: 10 });
    assert.ok(matches.length > 0, `OpenSearch returned no matches for tenant ${tenantId}`);
    assert.ok(matches.every((match) => match.tenantId === tenantId));
    assert.equal(matches[0].id, "offer-target");
  } finally {
    await opensearchClient.indices.delete({ index: indexName }, { ignore: [404] }).catch(() => {});
    await pool.query("DELETE FROM outbox_events WHERE id = $1", [outboxId]).catch(() => {});
    await pool.query("DELETE FROM equipment WHERE id IN ($1, $2)", [equipmentId, failedEquipmentId]).catch(() => {});
    await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]).catch(() => {});
    await clickhouse.close();
    await pool.end();
  }
});
