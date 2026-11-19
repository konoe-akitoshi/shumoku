---
'shumoku-plugin-zabbix': patch
---

Alerts: return every problem still open, however long ago it started. The last hour's window now limits only the resolved ones, so an alert no longer drops out (and its topology highlight with it) an hour after it starts.
