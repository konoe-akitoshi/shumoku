# shumoku-plugin-zabbix

## 0.2.26

### Patch Changes

- e5c79a4: Remove dead `ZabbixLinkMapping.in/out` explicit-itemid vocabulary.

  The `in`/`out` fields on `ZabbixLinkMapping` (explicit Zabbix itemids on a
  link mapping) were never written by the entity-keyed `StoredLinkMapping`
  store and are unreachable dead code. Their read path in `resolveLinkItemIds`
  is deleted; the monitoredNodeId+interface resolution path (cache + bulk
  `item.get`) is the only resolution path. The `ZabbixLinkMapping` interface
  extension is removed entirely.

- 38b4086: Add a first-class `secret` flag to plugin config schemas.

  `PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
  exports `isSecretProp`. Secret-ness is declared once on the schema
  (`secret: true`; `format: 'password'` is still honoured for back-compat), so the
  host can render token/password fields masked with a show/hide reveal toggle and
  suppress password-manager autofill from a single definition — no per-plugin
  branches, no hard-coded field-name lists.

  Bundled plugins mark their token/password/webhook-secret fields with
  `secret: true`.

- 22b660b: Fix the Zabbix alerts widget showing already-resolved problems when
  `activeOnly` is requested.

  `event.get` was filtered with a top-level `value` parameter, which Zabbix
  ignores (value filtering must go through `filter`), so recovery events leaked
  through. Even with that fixed, a problem that has since recovered still carries
  its original `value=1` event, so active-only queries now also drop events whose
  `r_eventid` points at a recovery event. The mapped `status` uses the same
  recovery check, so resolved-but-recent problems are no longer reported as
  active.

- 768592e: Batch Zabbix metrics polling and cache interface→itemid resolution.

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

- 46f9432: Fix LLDP neighbor resolution by using real sysname from host inventory and matching against all name fields.
- Updated dependencies [1be13c4]
- Updated dependencies [d9625fb]
- Updated dependencies [e60404d]
- Updated dependencies [14db853]
- Updated dependencies [d2b560c]
- Updated dependencies [b19c2ec]
- Updated dependencies [caf0c50]
- Updated dependencies [d943f92]
- Updated dependencies [3764162]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
  - @shumoku/core@0.3.0
