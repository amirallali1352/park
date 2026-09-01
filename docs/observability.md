# Observability

STP OS exposes three lightweight operational endpoints:

- `GET /health` — liveness check. Returns `200` when the API process is responding.
- `GET /ready` — readiness check. Returns `200` when configured dependencies are available and `503` otherwise.
- `GET /metrics` — Prometheus-compatible text metrics for request count and process uptime.

The readiness response includes dependency states. In the production configuration, the API checks PostgreSQL, ClickHouse, and OpenSearch when those integrations are enabled. In memory mode, the dependency map is empty and the service reports ready.

These endpoints are intentionally public so container orchestrators and monitoring agents can call them without an application session.
