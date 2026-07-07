---
'shumoku-plugin-zabbix': patch
---

Remove dead `ZabbixLinkMapping.in/out` explicit-itemid vocabulary.

The `in`/`out` fields on `ZabbixLinkMapping` (explicit Zabbix itemids on a
link mapping) were never written by the entity-keyed `StoredLinkMapping`
store and are unreachable dead code. Their read path in `resolveLinkItemIds`
is deleted; the monitoredNodeId+interface resolution path (cache + bulk
`item.get`) is the only resolution path. The `ZabbixLinkMapping` interface
extension is removed entirely.
