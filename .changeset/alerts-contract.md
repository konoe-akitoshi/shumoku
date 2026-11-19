---
'@shumoku/core': patch
---

plugin-kit: `validateAlertsContract` / `meetsAlertsContract` check an alert plugin's answer (ids present and unique, finite start times, known statuses). The Server now collects alert sources itself and reads an open alert missing from a successful answer as resolved, so `getAlerts({ activeOnly: true })` must return every open alert or throw.
