---
'shumoku-plugin-prometheus': patch
---

Take a link's status from the monitored interface's IF-MIB operational status. The `snmp` preset reads `ifOperStatus` (1 up, 2 and 7 down, others unknown), and custom metrics can name one with `operStatus`. A link used to read as up whenever it had traffic data, so an unplugged cable only showed as traffic fading out over the rate window. A down port is now reported as down even after its traffic series stops; without the metric, behavior is unchanged.
