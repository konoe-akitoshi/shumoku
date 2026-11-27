# @shumoku/cli

## 0.3.3

### Patch Changes

- 570c86e: Name the relative placement the drawing solves: `layoutNetwork(model)` returns `{ scene, arrangement }`, where `Arrangement` lists each frame's children left to right with the rows they hold, by id, and `unmet`, the order hints the structure overrode. `drawNetwork` now reads `drawing.order` from the model itself (the `hints` option is gone), and `resolveNetwork` carries it through the merge, so the Editor and the Server draw one model the same way. An order list is sparse: `pinned` moves only the named children that are out of the asked order, each to just after the one named before it, so a drag no longer displaces untouched siblings. Redundancy sets may be named by their id. `NetworkModel.sources`, which nothing read or wrote, is removed.
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
- 64a17e6: Draw networks that stopped the layout with "the constraints contain a cycle". A lone node in a group that holds no linked node now stands in the top row of the nearest group that does, so its group no longer reaches above a line that enters it. A line laid straight across between two boxes side by side is bent instead where the ports of a side leave its height no solution. Siblings whose rows overlap are no longer stacked one above the other. A port whose lines leave by two sides is drawn on each without stopping the renderer. A port held too near a line it cannot meet straight is moved off to the side that has room, instead of always the side it leans to.
- fea9b1c: `NetworkModel` is now two things: `config` (the network in the YAML's shape) and `drawing` (looks and order). The design layer is gone: a node's ports (`ports[]`, each with `name`, `label`, `interfaceName`, `aliases`, `role`, `faceplateLabel`, `speed`, `connectors`, `poe`, `source`, `notes`), its `productId`, `platform`, `service` and `resource`, a link end's `plug` (cage and module), a link's `cable` (`type` and `productId`, or the type written bare) and `via`, and the network's `terminations` are configuration, written in the YAML and merged like every other field. The observation record (identity, provenance, attachments, exclusions) is no longer part of the model: `resolveNetwork(project: SourceNetwork, snapshots)` returns `{ model, observation }`, `toNetworkGraph(model, observation?)` joins it into the graph when given, `fromNetworkGraph(graph)` returns `{ model, observation? }`, and `graphToSource(graph)` is the inverse of `sourceToGraph`. `SourceNetwork` lost its `design` layer: a plugin writes a node's ports on the node. Coordinates never ride in the network: node `position` / `size`, group `bounds`, link `bends`, `Termination.position` and port `placement` are removed from the graph types, as are `fieldSources`, group `membership` and `direction`, and a port's `disabled`. `Termination.metadata` became `autoFor`.

## 0.3.2

### Patch Changes

- 1424124: Draw hosting as containment: a host is drawn as one box holding the VMs on it (its own card as the heading, the VMs in a grid below), and a cluster named as a host as a frame round its nodes and those VMs, as vSphere, Proxmox and cloud diagrams do. The host is still the node: its ports sit on the box's edge.

## 0.3.1

### Patch Changes

- b7491ba: The CLI now carries the libraries released with core 0.6.0. It builds them into its own file, so CLI 0.3.0 still drew with core 0.5.0: no colour for a line's one VLAN, `external` and `cloud` nodes not always at the top, a VM on a host no line reaches left out, and the same network drawn differently when its links were listed in another order.

## 0.3.0

### Minor Changes

- 6f89ee5: **`shumoku render` reads the new network YAML and draws with the new engine.**
  
  - It reads only the new YAML. JSON written in the same shape is also read. The older YAML and graph JSON must be rewritten; see the YAML reference.
  - A network that cannot be read is refused with every issue listed at once, each with its path.
  - SVG, PNG and HTML are drawn by the new drawing engine. HTML adds pan, zoom and tooltips, and the whole network is one page: sheet navigation is gone.
  - The options are unchanged: `-f` / `--format`, `-o` / `--output` (default `output.<format>`), `--theme` and `--scale`.

## 0.2.28

### Patch Changes

- 97a473f: Define CLI options once in a typed command model shared by argument parsing, help output, and documentation generation.

## 0.2.27

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.

## 0.2.26

### Patch Changes

- 66a4b6d: Publish the Shumoku command-line renderer as the public `@shumoku/cli` npm package.
