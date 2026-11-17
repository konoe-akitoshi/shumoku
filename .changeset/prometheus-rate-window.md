---
'shumoku-plugin-prometheus': patch
---

Make the traffic query's window and function configurable with `rateWindow` (a Prometheus duration, default `5m`) and `rateFunction` (`rate` or `irate`, default `rate`). The window used to be fixed at `rate(...[5m])`, so a traffic shift took minutes to show even with a 1s scrape. A window that is not a Prometheus duration falls back to `5m`.
