---
'shumoku-plugin-zabbix': patch
---

Batch Zabbix metrics polling and cache interface→itemid resolution.

`pollMetrics` previously made up to two `item.get` round-trips per link every
cycle: one to resolve the interface's traffic itemids, then one to fetch their
values. On a large weathermap this was O(2 × links) calls per poll.

Now a per-instance cache keyed by `hostId|interface` remembers the resolved
itemids (stable between polls), so steady-state polling resolves entirely from
cache. Cache misses are resolved together in host-id-batched `item.get`
searches, and the values for every link's itemids are fetched in a single
`item.get` (chunked only past 500 ids). A cached itemid the value fetch stops
returning (item deleted/disabled) is evicted so the host re-resolves next
cycle. Utilization/freshness semantics are unchanged.
