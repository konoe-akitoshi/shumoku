---
'shumoku-plugin-prometheus': patch
---

`testConnection()` now fails (instead of silently reporting success) when the
health check passes but `/api/v1/status/buildinfo` doesn't respond. Hosts and
metrics both depend on the query API, so a target that passes the health
check with no query engine at all (e.g. this URL points at a scrape/forward
agent like vmagent instead of the queryable Prometheus/VictoriaMetrics
server) was previously reported as a successful connection with zero
hosts/metrics and no indication why.
