# @shumoku/renderer-svg

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
- Updated dependencies [2db8b4e]
- Updated dependencies [bcefedd]
- Updated dependencies [3967c02]
- Updated dependencies [317dd26]
- Updated dependencies [e5d6270]
- Updated dependencies [475ba09]
- Updated dependencies [b7f7d80]
  - @shumoku/core@0.7.0
  - @shumoku/renderer@0.3.3

## 0.3.1

### Patch Changes

- Updated dependencies [173780d]
- Updated dependencies [62252ae]
- Updated dependencies [5bece3c]
  - @shumoku/core@0.6.0
  - @shumoku/renderer@0.3.1

## 0.3.0

### Minor Changes

- 6f89ee5: **A thin wrapper over `@shumoku/renderer/static`.** The SVG is drawn by the new drawing engine.
  
  - `renderNetworkSvg(model, options)` draws a model to a standalone SVG string. `renderSceneSvg(scene)` and `drawNetworkScene(model)` are re-exported, and `renderGraphToSvg(graph)` still takes a graph. The `theme` option is a `Theme` object such as `darkTheme`, not a string.
  - The icon fetch helpers and `generateThemeCSS` stay.
  - **Removed:** the old pipeline and renderer, namely `prepareRender`, `renderSvg`, `renderEmbeddable`, `SVGRenderer`, `LegacySVGRenderer`, the `svg` namespace, `resolveAllIconDimensions`, `collectIconUrls`, `fetchImageDimensions` and their option types. Draw with `renderNetworkSvg`.
  - Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.

### Patch Changes

- Updated dependencies [6f89ee5]
- Updated dependencies [6f89ee5]
  - @shumoku/core@0.5.0
  - @shumoku/renderer@0.2.0

## 0.2.29

### Patch Changes

- 704357a: Sanitize inline SVG icons (`spec.icon`) before they are rendered, so an icon can't run script in the viewer's browser. `@shumoku/core` adds `sanitizeIconSvg` / `sanitizeIconSvgWith` (DOMPurify-based) and `@shumoku/renderer` sanitizes inline icons in its Svelte components and exports `sanitizeInlineIcon`. `@shumoku/renderer-svg` now escapes icon URLs in `<image href>`.
- Updated dependencies [9830a35]
- Updated dependencies [0e8b8b4]
- Updated dependencies [704357a]
  - @shumoku/core@0.4.2
  - @shumoku/renderer@0.1.5

## 0.2.28

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0
  - @shumoku/renderer@0.1.3

## 0.2.27

### Patch Changes

- bbc9212: Isolate the deprecated LayoutResult SVG renderer behind an explicit legacy compatibility boundary.

## 0.2.26

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.
- 48199ff: Redundancy groups (HA / vPC / MLAG / stack) render as a "glasses hull": one
  solid silhouette behind the member nodes — a rounded lens per member joined by
  a notched bridge at the seam — replacing the old parallel double-line
  ("glasses") link rendering.

  - The redundancy link itself now draws as a NORMAL link: ports, port labels
    and hit-testing survive, and the link is metrics-mappable like any other
    wire, so the weathermap overlay (utilization color / flow particles / idle)
    applies with no special-casing.
  - Coupling seam ports render as elongated stack-port bars with the label
    inside (rotated on lateral faces).
  - New core geometry util `buildHaHullPath` / `groupCouplingPairs` shared by
    the interactive renderer and the static SVG renderer, which now draws the
    hull too (it previously rendered redundancy links as plain lines).
  - Layout: coupling ports seat inward on the facing sides; the redundancy-pair
    gap widens (16 → 48) so the seam link and hull notch have room.
  - New `haHullFill` render-color token (theme-invariant `#3c3c3c`).

  Only links with an explicit `redundancy:` field get this treatment — no
  automatic pair inference.

- Updated dependencies [1be13c4]
- Updated dependencies [581e351]
- Updated dependencies [d9625fb]
- Updated dependencies [e60404d]
- Updated dependencies [14db853]
- Updated dependencies [48199ff]
- Updated dependencies [368672f]
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
- Updated dependencies [0e3bed0]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [2e27e77]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
- Updated dependencies [a8370b8]
- Updated dependencies [091471f]
  - @shumoku/core@0.3.0
  - @shumoku/renderer@0.1.1
