# shumoku-plugin-zabbix

## 0.3.2

### Patch Changes

- d5f9beb: Device attributes are configuration. A node's `address`, `sysName`, `chassisId` and `mac` and a
  port's `mac` are fields of the network YAML (`inputModel.Node` / `Port`); `resolveNetwork` matches
  nodes on them (and on a node's segment addresses) plus each source's own `vendorIds`, which stay in
  the source's observation with a port's `ifIndex`. The `identity` field is gone from the observation
  record, and the drawn graph (`Node`, `NodePort`, `Link`, `Subgraph`, `NetworkGraph`) carries no
  `identity`, `provenance`, `entityId`, `attachments`, `metadata` or `exclusions`: `toNetworkGraph(model)`
  takes no observation and `fromNetworkGraph(graph)` returns a `NetworkModel`. The graph-shaped
  `resolve()` / `SnapshotEntry` / `ResolvedGraph`, `graphToSource`, `stampObserved` and
  `deriveMappingFromGraph` are removed; `deriveMapping(graph, observation)`,
  `effectivePolicyForNode(graph, observation, node)`, `nodeIdentityKeys(DeviceKeys)`,
  `portIdentityKeys(PortKeys)`, `deviceKeysOfIdentity`, `segmentAddressesOf`, `deviceAttributes` and
  `vendorIdsOf` replace them. `validateTopologyIdentityContract` reports `portsMissingName` instead of
  `portsMissingIfName`. Topology plugins write the attributes on the nodes and ports they return.
- fea9b1c: `NetworkModel` is now two things: `config` (the network in the YAML's shape) and `drawing` (looks and order). The design layer is gone: a node's ports (`ports[]`, each with `name`, `label`, `interfaceName`, `aliases`, `role`, `faceplateLabel`, `speed`, `connectors`, `poe`, `source`, `notes`), its `productId`, `platform`, `service` and `resource`, a link end's `plug` (cage and module), a link's `cable` (`type` and `productId`, or the type written bare) and `via`, and the network's `terminations` are configuration, written in the YAML and merged like every other field. The observation record (identity, provenance, attachments, exclusions) is no longer part of the model: `resolveNetwork(project: SourceNetwork, snapshots)` returns `{ model, observation }`, `toNetworkGraph(model, observation?)` joins it into the graph when given, `fromNetworkGraph(graph)` returns `{ model, observation? }`, and `graphToSource(graph)` is the inverse of `sourceToGraph`. `SourceNetwork` lost its `design` layer: a plugin writes a node's ports on the node. Coordinates never ride in the network: node `position` / `size`, group `bounds`, link `bends`, `Termination.position` and port `placement` are removed from the graph types, as are `fieldSources`, group `membership` and `direction`, and a port's `disabled`. `Termination.metadata` became `autoFor`.
- 7ddd571: Leave `identity.sysName` unset unless `inventory.name` supplies it. The plugin used to fall back to `host.name`, an operator display string, which made a host read by both Zabbix and SNMP fail to merge when the two names differed.
- Updated dependencies [570c86e]
- Updated dependencies [60d6f2f]
- Updated dependencies [d5f9beb]
- Updated dependencies [64a17e6]
- Updated dependencies [eb1f58e]
- Updated dependencies [b262fe4]
- Updated dependencies [fea9b1c]
- Updated dependencies [bcefedd]
- Updated dependencies [317dd26]
- Updated dependencies [e5d6270]
- Updated dependencies [475ba09]
  - @shumoku/core@0.7.0

## 0.3.1

### Patch Changes

- Updated dependencies [173780d]
- Updated dependencies [62252ae]
- Updated dependencies [5bece3c]
  - @shumoku/core@0.6.0

## 0.3.0

### Minor Changes

- 6f89ee5: **Topology comes back as a `SourceNetwork`, the input's own shape** (see `@shumoku/core`). `fetchTopology()` resolves to one, and the server merges it with the project's configuration.
  
  - NetBox: `toYaml` writes the new network YAML from `convertToSourceNetwork`. The older graph converter and the per-location YAML converter are removed. Links no longer set the removed `arrow` field, and nodes no longer carry `rank`.
  - Zabbix: LLDP links carry their speed.
  - **Fixed:** the plugins name `@shumoku/core` and `@shumoku/plugin-sdk` by version range. 0.2.30 declared `workspace:*` and could not be installed from npm.

### Patch Changes

- Updated dependencies [6f89ee5]
  - @shumoku/core@0.5.0

## 0.2.30

### Patch Changes

- Updated dependencies [9830a35]
- Updated dependencies [0e8b8b4]
- Updated dependencies [704357a]
  - @shumoku/core@0.4.2

## 0.2.29

### Patch Changes

- Updated dependencies [cbc429d]
  - @shumoku/core@0.4.1
  - @shumoku/plugin-sdk@0.1.1

## 0.2.28

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0

## 0.2.27

### Patch Changes

- Updated dependencies [78f6864]
  - @shumoku/core@0.3.1

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
- Updated dependencies [48199ff]
- Updated dependencies [d2b560c]
- Updated dependencies [97a4cf6]
- Updated dependencies [b19c2ec]
- Updated dependencies [6dcfdc3]
- Updated dependencies [caf0c50]
- Updated dependencies [97a4cf6]
- Updated dependencies [d943f92]
- Updated dependencies [3764162]
- Updated dependencies [4639a38]
- Updated dependencies [912bf6f]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [2e27e77]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
- Updated dependencies [a8370b8]
- Updated dependencies [091471f]
  - @shumoku/core@0.3.0
