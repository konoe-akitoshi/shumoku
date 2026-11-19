---
'shumoku-plugin-grafana': patch
'shumoku-plugin-prometheus': patch
---

Alerts: a failed fetch from Alertmanager now throws instead of returning no alerts, so a monitoring system that cannot be reached no longer reads as one with nothing wrong.
