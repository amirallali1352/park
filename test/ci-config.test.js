import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("GitHub Actions CI runs the locked dependency install and full test suite", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /actions\/checkout@v\d/);
  assert.match(workflow, /actions\/setup-node@v\d/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run perf:operations/);
});

test("GitHub Actions CI validates Docker Compose configuration", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /docker compose config --quiet/);
});

test("GitHub Actions CI includes dependency auditing", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /npm audit --audit-level=high/);
});

test("GitHub Actions CI runs the Docker-backed integration path", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflow, /docker compose up -d postgres redpanda minio opensearch clickhouse/);
  assert.match(workflow, /RUN_INTEGRATION:\s*true/);
  assert.match(workflow, /test\/docker-integration\.test\.js/);
});
