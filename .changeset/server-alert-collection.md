---
---

Server only (no npm release beyond the plugin changesets): the Server collects each alert source once per interval and keeps its state (`alert_state` / `alert_events`); the alerts REST and shared dashboards read what it collected. Polling intervals are set on the Settings page (alerts, metrics, topology sync) and can be overridden per data source.
