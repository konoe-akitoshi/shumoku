---
'shumoku-plugin-zabbix': patch
---

Fix the Zabbix alerts widget showing already-resolved problems when
`activeOnly` is requested.

`event.get` was filtered with a top-level `value` parameter, which Zabbix
ignores (value filtering must go through `filter`), so recovery events leaked
through. Even with that fixed, a problem that has since recovered still carries
its original `value=1` event, so active-only queries now also drop events whose
`r_eventid` points at a recovery event. The mapped `status` uses the same
recovery check, so resolved-but-recent problems are no longer reported as
active.
