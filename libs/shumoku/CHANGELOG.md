# shumoku

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
  - @shumoku/renderer-svg@0.3.2
  - @shumoku/renderer-html@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [173780d]
- Updated dependencies [62252ae]
- Updated dependencies [5bece3c]
  - @shumoku/core@0.6.0
  - @shumoku/renderer-html@0.3.1
  - @shumoku/renderer-svg@0.3.1

## 0.3.0

### Minor Changes

- 6f89ee5: **The wrapper follows the new core and renderers.** It re-exports all of `@shumoku/core` (models, the YAML reader, the drawing engine, themes) together with the SVG and HTML renderers. The PNG renderer is separate: `@shumoku/renderer-png`. See `@shumoku/core` for the new YAML and the APIs that replace the old ones.
  
  - **Removed:** the hierarchical HTML functions (`renderHierarchical`, `renderHtmlHierarchical`, `renderGraphToHtmlHierarchical`) and the `svg` namespace.
  - Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.

### Patch Changes

- Updated dependencies [6f89ee5]
- Updated dependencies [6f89ee5]
- Updated dependencies [6f89ee5]
  - @shumoku/core@0.5.0
  - @shumoku/renderer-html@0.3.0
  - @shumoku/renderer-svg@0.3.0

## 0.2.8

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0
  - @shumoku/renderer-html@0.2.28
  - @shumoku/renderer-svg@0.2.28

## 0.2.7

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.
- Updated dependencies [1be13c4]
- Updated dependencies [581e351]
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
  - @shumoku/renderer-html@0.2.26
  - @shumoku/renderer-svg@0.2.26
