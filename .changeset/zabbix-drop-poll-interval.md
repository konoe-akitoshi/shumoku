---
'shumoku-plugin-zabbix': patch
---

Remove the `pollInterval` config field: nothing ever read it. How often the Server reads a data source is now set on the Server's Settings page (and can be overridden per data source).
