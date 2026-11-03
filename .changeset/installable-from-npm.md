---
'@shumoku/catalog': patch
'shumoku-plugin-grafana': patch
'shumoku-plugin-prometheus': patch
---

Name `@shumoku/core` by version range instead of `workspace:*`. `@shumoku/catalog` 0.1.5 was published with `workspace:*` and could not be installed from npm; the Grafana and Prometheus plugins would have gone out the same way.
