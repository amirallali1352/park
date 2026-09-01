import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const composePath = new URL("../docker-compose.yml", import.meta.url);

test("Docker Compose defines Prometheus and Grafana observability services", async () => {
  const compose = await readFile(composePath, "utf8");

  assert.match(compose, /\n\s+prometheus:\r?\n/);
  assert.match(compose, /prom\/prometheus/);
  assert.match(compose, /prometheus\.yml/);
  assert.match(compose, /\n\s+grafana:\r?\n/);
  assert.match(compose, /grafana\/grafana/);
  assert.match(compose, /3001:3000/);
});

test("Prometheus configuration scrapes the STP OS metrics endpoint", async () => {
  const config = await readFile(new URL("../observability/prometheus/prometheus.yml", import.meta.url), "utf8");

  assert.match(config, /metrics_path:\s*\/metrics/);
  assert.match(config, /host\.docker\.internal:3000/);
  assert.match(config, /job_name:\s*stp-os-api/);
});

test("Grafana has a provisioned STP OS dashboard provider", async () => {
  const provider = await readFile(
    new URL("../observability/grafana/provisioning/dashboards/provider.yml", import.meta.url),
    "utf8"
  );
  const dashboard = await readFile(
    new URL("../observability/grafana/dashboards/stp-os-overview.json", import.meta.url),
    "utf8"
  );

  assert.match(provider, /stp-os-dashboards/);
  assert.match(dashboard, /STP OS Overview/);
  assert.match(dashboard, /stp_os_http_requests_total/);
});
