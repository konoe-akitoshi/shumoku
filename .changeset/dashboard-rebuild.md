---
---

Server only (no npm release): the dashboard is rebuilt on `@appulsauce/svelte-grid` with Svelte-rendered widgets, one shared `TopologyView` (camera buttons with Fit), schema-driven widget settings, and alert highlights kept as state until the alert resolves, also on shared dashboards. Alerts are grouped and ordered by severity with stale ones set apart, and a wall display gets a change log, new-alert beats, update-stopped warnings, an optional camera that follows new alerts, and a return to the whole topology when left idle.
