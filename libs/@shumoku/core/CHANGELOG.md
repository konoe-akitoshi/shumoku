# @shumoku/core

## 0.7.0

### Minor Changes

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

### Patch Changes

- 570c86e: Name the relative placement the drawing solves: `layoutNetwork(model)` returns `{ scene, arrangement }`, where `Arrangement` lists each frame's children left to right with the rows they hold, by id, and `unmet`, the order hints the structure overrode. `drawNetwork` now reads `drawing.order` from the model itself (the `hints` option is gone), and `resolveNetwork` carries it through the merge, so the Editor and the Server draw one model the same way. An order list is sparse: `pinned` moves only the named children that are out of the asked order, each to just after the one named before it, so a drag no longer displaces untouched siblings. Redundancy sets may be named by their id. `NetworkModel.sources`, which nothing read or wrote, is removed.
- 60d6f2f: `resolveNetwork` clusters sources in priority order, so the highest-priority source's view decides
  how devices cluster regardless of the order the snapshots are listed in.
- 64a17e6: Draw networks that stopped the layout with "the constraints contain a cycle". A lone node in a group that holds no linked node now stands in the top row of the nearest group that does, so its group no longer reaches above a line that enters it. A line laid straight across between two boxes side by side is bent instead where the ports of a side leave its height no solution. Siblings whose rows overlap are no longer stacked one above the other. A port whose lines leave by two sides is drawn on each without stopping the renderer. A port held too near a line it cannot meet straight is moved off to the side that has room, instead of always the side it leans to.
- eb1f58e: Balance the drawing: a box with room to spare now stands in the middle of it instead of at the left edge, and every box is drawn weakly towards the middle of the boxes it hands over to (and is handed over by).
  
  A switch with many terminals no longer draws them in one very wide row: a fan of more than six boxes folds into rows of at most five, the later rows one rank lower and standing under the first as one block.
  
  A group with no group inside it is now drawn compactly on its own and set into its parent as one box, so a wide group no longer spreads across the whole drawing.
- b262fe4: A link that names no speed and no module standard takes the slower of its ends' port speeds (the only one when one end names it), so lines are drawn by the speeds real devices report.
  
  A step too small for a jog between two ports that no neighbour can widen is left as it is, where it stopped drawing ("the constraints contain a cycle") once lines of different widths moved the ports.
- bcefedd: When the names of the ports on one edge ask for more room than the edge may have, write the start they share once. `Metrics.portSides` may return a `caption` for an edge (the common prefix, cut at a token boundary: `Te1/0/`), and the scene lists it in `captions` with the corner the edge starts from. The renderer draws it as a bold chip at that corner and leaves it off each port's own chip; every port still carries its full `name`, which is its tooltip.
- 317dd26: Space ports by their neighbours instead of by the widest name in the box. `Metrics.portSlot(labels)` is replaced by `Metrics.portSides(box)`, which answers for each edge of a box the text of every chip, the least distance between each neighbouring pair (and a pair one apart), the margins at the ends and how far the names reach out. A top or bottom edge asks for half of each chip's width between neighbours; a left or right edge asks for the chip's height only, so a long name no longer stretches the side of a box. Scene ports now carry `name` (the stored name, in full) and `label` (what is written in the chip); the renderer draws `label` and puts `name` in the tooltip.
- e5d6270: Set the port names of a long top or bottom edge in two rows when one row would widen the box. A port in `PortSideLayout` may stand in row 1, every other chip of the edge, and a pair two ports apart may ask for a distance of its own (`gaps` with `to - from` of 2). The scene's ports carry the `row`, and the renderer draws the outer row one chip farther out. A side's `depth` is now how far the outer edge of its outermost chip stands from the port; where that is more than the lead-out, the room between ranks, and between a box and the line that passes it, grows by the difference.
- 475ba09: One line between two places that each have their own way in no longer puts all of one under all of the other. A place is stacked under another only when it hangs from it (every flow into it comes through the other) or when the flows already put every way into it below the other. A line into a box deep in a group drawn on its own no longer moves the whole group, its top included, down a rank.

## 0.6.1

### Patch Changes

- 1424124: Draw hosting as containment: a host is drawn as one box holding the VMs on it (its own card as the heading, the VMs in a grid below), and a cluster named as a host as a frame round its nodes and those VMs, as vSphere, Proxmox and cloud diagrams do. The host is still the node: its ports sit on the box's edge.

## 0.6.0

### Minor Changes

- 5bece3c: A line's colour now names one VLAN, and the colours are worked out rather than listed.
  
  - **What is coloured.** A line carrying a single VLAN is drawn in that VLAN's colour, so the links of one VLAN can be followed by it. A trunk, which carries several VLANs, is drawn in the plain line colour; its caption lists what it carries. Before, every distinct set of VLANs got a colour of its own, so a trunk's colour named nothing.
  - **Where the colours come from.** A theme now has `colors.lineTone`: an OKLCH lightness, the most chroma it allows, and a starting hue. The colours follow from it. The hues are spaced evenly, at the least chroma that keeps them apart, so a few VLANs are soft and more of them a little more vivid.
  - **What every colour meets.** Contrast of at least 3:1 against every background a line can lie on (WCAG 2.1 non-text contrast), and four just-noticeable differences in OKLab from every other colour.
  - **When there are more VLANs than that.** If a diagram has more single-VLAN VLANs than the tone can tell apart (7 in the light theme, 9 in the dark), none is coloured: a colour shared by two VLANs would say they are one.
  - **New exports.** `lineColors`, `lineColorCapacity`, `fittingLineTone` (works out a tone from a new theme's backgrounds), `toneFits`, `contrastRatio`, `hueOf` and `oklchToHex`.
  - **Removed.** `colors.vlans` is gone.

### Patch Changes

- 173780d: **Drawing fixes found by drawing a NetBox.** `external` and `cloud` nodes are the top whenever the input has any, ahead of the nodes where a cable meets a virtual link (a NetBox with tunnels, VM adapters and L2VPNs had its transits drawn at the bottom). A VM on a host that no line reaches, such as a VM in a cloud, is drawn beside its host instead of being left out (and a line to it no longer fails with "no way through the corridors"). Two lines laid straight across between the same two boxes, with ports named in opposite orders on the two sides, no longer fail with "the constraints contain a cycle".
- 62252ae: The drawing no longer depends on the order the `links` are written in. Before, the links were numbered by where they stood in the file, and that number broke ties in the layout: listing the same links in another order could move most of the boxes of a larger network (26 of 30 in a generated test network). The links are now numbered by what they say, so the same network gives the same drawing however its links are listed. This matters most where the links come from a data source whose order is not fixed.
  
  Networks whose layout had a tie decided by the link order are drawn once differently. Among the examples this is `full-featured.yaml`; the crossings and other checked rules come out the same.

## 0.5.0

### Minor Changes

- 6f89ee5: **A new network input, a new model and a new drawing engine.** This release changes how shumoku reads a network and how it draws one. Neither the old YAML nor the old layout API carries over: rewrite the YAML in the new shape, and move to the APIs below.
  
  ### Reading a network
  
  - The network YAML has a new shape: `nodes`, `links` with two `endpoints` (a node and its port, a segment, or a routing domain), `groups`, `segments`, `redundancy`, `routingDomains` and `connections`. The types are in the `inputModel` namespace, and the YAML reference is generated from them. The older YAML (`settings`, `subgraphs`, `from` / `to`, …) and graph JSON are not read and have no converter.
  - `readNetworkModel(text)` reads YAML into a `NetworkModel`. It refuses a network it cannot read as written and lists every issue at once, each with its path: an unknown field (with the closest name), a value of the wrong shape, or an id nothing defines. It throws a `NetworkInputError` carrying the issues; `checkNetwork(value)` returns them without throwing. `writeNetworkModel` writes the configuration back as YAML.
  - `NetworkModel` is the configuration as the YAML writes it (`config`), what each source discovered (`sources`), and the `observation`, `design` and `drawing` layers keyed by the configuration's ids.
    - `toNetworkGraph` and `fromNetworkGraph` convert to and from the display graph.
    - `applyGraphEdits(model, drawn, edited)` writes edits made on a drawn graph back into the model and keeps what the graph cannot say.
    - `resolveNetwork` merges the model with each source's `SourceNetwork`.
  - The sample network is `sampleNetworkModel()` (YAML: `sampleNetworkYaml`).
  
  ### Drawing
  
  - `drawNetwork(model, { metrics, hints })` draws a model as a `Scene`: boxes, ports, wires with their corner radii, group frames and hulls. `metrics` is a function `(model) => Metrics`; `drawNetworkScene(model)` in `@shumoku/renderer` supplies the kit's. `layoutDrawing` is the layout behind it, and `deriveStructure` gives the structure it measures from.
  - Every discrete choice (ranks, left-to-right order, routes, the order of lines) is made from the network's relations before any coordinate. The coordinates are then solved once per axis, so text that measures a little differently moves things a little and changes nothing else.
  - Up and down are measured from a boundary, decided in this order:
    1. `drawing.settings.boundary`;
    2. nodes with both a cable and a virtual link;
    3. `external` / `cloud` nodes and the routing domains links reach;
    4. for each connected part none of these reaches, a guessed upstream: by node type (router, firewall, VPN, CPE, then L3 switch and load balancer, then L2 switch, then access point), then the fastest link, then the centre of the part.
  - Lines are orthogonal, with 45° chamfers and rounded corners. Nested groups are drawn on one page.
  - `hints.siblings` fixes the left-to-right order of a frame's children where the structure leaves them free. `DrawingLayer.order` keeps the order a person dragged them into (`ROOT_FRAME` for the top level). `drawNetwork` does not read it by itself: pass it as `hints`.
  
  ### Plugins
  
  - Topology plugins return what they discovered as a `SourceNetwork`: the network in the input's shape, with identity and provenance in its observation layer, port facts in its design layer and icons in its drawing layer. `fetchTopology()` resolves to one, `Snapshot.source` holds one (it was `Snapshot.graph`), and `validateTopologyIdentityContract` checks one. `sourceToGraph` builds a graph from it, and `rateFromBps` writes a rate the way the input does.
  
  ### Removed
  
  - The old layout engine: `computeNetworkLayout`, `createNetworkLayoutEngine`, `createEngine`, `routeEdges`, `placePorts`, `moveNode`, `rebalanceSubgraphs`, `collectObstacles`, `buildHierarchicalSheets`, the `Resolved*` types, `LayoutResult`, the node-size and port-label constants, and the `@shumoku/core/layout` subpath.
  - The old parser: `YamlParser`, `HierarchicalParser`, the file resolvers, `dumpGraph`, and the `@shumoku/core/parser` and `@shumoku/core/parser/node` subpaths.
  - Sheets and hierarchical views (`file:` / `pins`).
  - Line styles the drawing does not draw: `ArrowType` and `LinkDrawing.arrow`, `EdgeStyle` / `SplineMode` and the `edgeStyle` / `splineMode` settings, and the `'solid'`, `'double'`, `'thick'` and `'invisible'` link types. `LinkType` is `'dashed' | 'dotted'`, and a link with no type is solid.
  - `Node.rank`.
  - `parseWithMaps` / `stringifyWithMaps` and the presentation helpers only the old renderers used.
  
  ### Renamed
  
  - `Link.rateBps` is now `speedBps`: the link's nominal speed, not its traffic. Ask `linkSpeedBps(link)`, which also reads the speed its ends' module standards name.
  
  ### Migrating
  
  | Before | Now |
  | --- | --- |
  | `new YamlParser().parse(text)` | `readNetworkModel(text)`, then `toNetworkGraph(model)` if you need the graph |
  | `computeNetworkLayout(graph)` | `drawNetwork(model, { metrics })`, or `drawNetworkScene(model)` from `@shumoku/renderer` |
  | `@shumoku/core/layout`, `@shumoku/core/parser` | removed; import from `@shumoku/core` |
  | `link.rateBps` | `linkSpeedBps(link)` |
  | `sampleNetwork` | `sampleNetworkModel()` |
  
  ### Fixed
  
  - `checkNetwork` reports an unknown top-level field as an issue. It used to throw a `ReferenceError`.

## 0.4.2

### Patch Changes

- 9830a35: Update production dependencies, including the core schema-validation dependency.
- 0e8b8b4: Avoid excessive regular-expression backtracking when validating plugin email configuration fields, while preserving the existing format contract.
- 704357a: Sanitize inline SVG icons (`spec.icon`) before they are rendered, so an icon can't run script in the viewer's browser. `@shumoku/core` adds `sanitizeIconSvg` / `sanitizeIconSvgWith` (DOMPurify-based) and `@shumoku/renderer` sanitizes inline icons in its Svelte components and exports `sanitizeInlineIcon`. `@shumoku/renderer-svg` now escapes icon URLs in `<image href>`.

## 0.4.1

### Patch Changes

- cbc429d: Update compatible runtime and build dependencies across published packages.

## 0.4.0

### Minor Changes

- 97a473f: Export a Zod runtime schema for YAML network documents and use it at the parser boundary so validation and generated reference documentation share one contract.

## 0.3.1

### Patch Changes

- 78f6864: Parser: read `identity`, `membership` and `scope` on subgraphs.

  `dumpGraph` wrote them but `YamlParser` never read them, so a graph exported to YAML and pasted back lost the key `resolve()` clusters regions by. A region that should merge with the same region a discovery source reports became two same-labelled boxes with the members split between them — from a document that looked correct, with no warning.

## 0.3.0

### Minor Changes

- 912bf6f: Make hand-authored graphs survive a YAML round trip.

  `YamlParser` read every `Node` field except `identity`, so a Manual data source's nodes were silently stripped of the keys `resolve()` clusters on and the metrics-mapping stack needs to bind a node to a monitoring host — leaving hand-drawn devices permanently unmappable. `NodePort.identity` was already parsed; this closes the same gap one level up.

  Adds `dumpGraph()`, the inverse of the parser, so a graph can be written back to authoring YAML without loss: it quotes values that need it (a label containing a newline made the previous hand-rolled writer emit an unparseable document) and spreads the graph rather than enumerating keys, converting only the three shapes the parser stores differently from how it reads them — `spec` on nodes and subgraphs, and `plug` on link endpoints. `parse(dumpGraph(g))` is a fixed point.

- 38b4086: Add a first-class `secret` flag to plugin config schemas.

  `PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
  exports `isSecretProp`. Secret-ness is declared once on the schema
  (`secret: true`; `format: 'password'` is still honoured for back-compat), so the
  host can render token/password fields masked with a show/hide reveal toggle and
  suppress password-manager autofill from a single definition — no per-plugin
  branches, no hard-coded field-name lists.

  Bundled plugins mark their token/password/webhook-secret fields with
  `secret: true`.

### Patch Changes

- 1be13c4: Add source-preserving metric observations and redundancy summaries so multiple monitoring paths can be aggregated without selecting a winning datasource.
- d9625fb: Composite layout draws bandwidth pipes again (log widths) and separates vertical risers by actual stroke width.

  The composite search engine was overwriting `ResolvedEdge.width` with the 'linear' routing experiment (10G→1px), collapsing access links to hairlines and starving the weathermap flow lanes. This patch restores the log-curve widths that `route-edges.ts` seeds and the renderers draw.

  Vertical risers now use a width-aware shift search: the reach scales to the widest ribbon already placed in the corridor so two 100G ribbons (34px each, needing ≥37px separation) always find room — the fixed ±32px ceiling was 5px short.

- e60404d: Brand `entityId` fields on Node, NodePort, and Link as `EntityId` (a string nominal type). Add `asEntityId` trust-boundary cast. Server-only writers; plugins never set entityId — no external callers affected.
- 14db853: Add optional `entityId` field to Node, NodePort, and Link for server-side entity registry stamping.
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

- d2b560c: validateTopologyIdentityContract now mirrors the server's ingest fallback exactly: a port with an empty identity object is fallback-eligible (ifName = port id), not a violation.
- 97a4cf6: fix(core): pick the most name-like label, not the highest-priority one

  Every source labels a node with the best it has, and "best" varies wildly: a
  controller that never learned a switch's hostname reports its model, a subnet
  sweep that never read the device reports the address it answered on, another
  source reports a wire address. All are placeholders standing in for a name, and
  choosing between them by source priority alone meant one switch displayed
  `172.16.254.208` while the next displayed `IS230-10TP-AC(V1)` — purely by which
  source happened to outrank the other for that device.

  No placeholder is recognised by its shape: no regex, no vendor strings, no
  address parsing. A label standing in for a name is one that merely repeats
  another field of the same node, so each is identified by the field it echoes
  and ranked by how much it tells a human reading a diagram — name, model,
  address, hardware address, opaque id. Within one rank the existing priority and
  recency order is untouched, and an operator-typed label is exempt: curation is
  intent, not a guess.

  The practical effect is that a source discovering a real hostname takes over the
  label the moment it appears, however low its priority.

- b19c2ec: Add a layout problem IR, semantic diagnostics for role-driven layout invariants, and routing intents that gate peer ramps, gutters, and bus grammars.
- 6dcfdc3: Layout: root at an Internet node even at degree 1, and stop reserving crowded-channel space where a single link crosses.

  Three fixes to vertical structure, all found chasing one symptom (an upstream chain rendering upside-down and airy):

  - **Rank root**: a tier-0 (Internet / Cloud) node was disqualified from seeding the rank root by the "management stub" guard, which rejects degree-1 boundary roles when fat trunks exist elsewhere. The real WAN edge looks exactly like that stub — one link, usually no speed on it — so the map rooted at the first internal router and rendered the Internet _below_ the access layer. Tier 0 is a declaration, not a guess, so it is now exempt.
  - **Composite band spacing**: the band gap is sized for a crowded channel (edges leaving a wide band, travelling sideways, then descending). Channels are now measured by how many links actually cross them; one crossing link needs only port-label clearance. Same rule inside zone hulls.
  - **Flat-tree block sizing**: a top-level node with no parent subgraph is its own single-member block but has no hull and no label strip, yet was padded like one — reserving phantom space around every such node in every gap the tidy-tree measures.

- caf0c50: **layout**: choose the diagram apex from structure first, role hints second.
  Device-type tiers say what a box _is_, not where it _sits_ — when the only
  role-tagged router in an inventory is a degree-1 management stub while the real
  WAN edge is a `generic` switch terminating the fattest trunk, trusting the role
  rooted the whole map at the stub and drew the network upside down.

  - A boundary-role device (≤ Router tier) seeds the rank root only when the
    structure corroborates it: degree ≥ 2, or it sits on a fat trunk, or the
    graph carries no bandwidth data at all (no evidence against it).
  - With no trustworthy boundary role, the root falls back to the physics: the
    most peripheral endpoint (lowest degree) of the fattest trunks.
  - Leaf classes (AP/CPE and deeper) never seed the root — a network whose
    lowest resolvable tier is its access points has no hierarchy information,
    and rooting at the leaves is exactly the inversion bug. Falls through to
    highest-degree instead.

- 97a4cf6: fix(core): canonicalise MAC-shaped identity keys so the same device merges across sources

  `buildIdentity` stored `mac` and `chassisId` exactly as the plugin spelled them, and
  identity matching compares key values as exact strings. Sources disagree on spelling for
  the same wire address — Huawei NCE returns `50-04-01-01-D5-50` in its device list and
  `CC:D8:1F:9F:D4:AB` in its LLDP table, an SNMP walk of that same switch yields
  `cc:d8:1f:9f:d4:ab`, Cisco gear writes `ccd8.1f9f.d4ab` — so one device arrived as two
  entities that never merged, silently. Both keys are now lowercased and colon-separated
  via the new `normalizeMacKey`, which also pads the unpadded octets BSD `arp` prints
  (`0:d:5d:11:f0:73`). Values that are neither twelve hex digits once separators are
  stripped nor six 1–2 digit groups are left untouched, since `chassisId` is only
  sometimes a MAC.

- d943f92: docs(plugin-types): document MetricsMapping key contract — keys are stable element ids (registry entity ids for stamped nodes/links since Phase 3); update pollMetrics/subscribeMetrics JSDoc
- 3764162: NetBox topologies now render as a proper top-down dependency hierarchy.

  - **netbox**: stamp `metadata.location` (site/location slug) on device nodes. The
    composite layout keys its zones off `metadata.location`, so NetBox topologies
    previously never qualified and fell back to the flat-tree engine even though
    NetBox knows each device's site/location. Matches the Zabbix plugin.
  - **core (composite layout, role-driven / typed graphs only)**: place nodes and
    subgraphs by their wiring (link) dependency.

    - Apex = the most peripheral boundary device (WAN edge router), chosen by BFS
      eccentricity instead of the device-type tier table (which ranked firewall
      above router and inverted the hierarchy). NetBox cables are undirected, so
      the root is the only orientation input.
    - Grow the tree from the root with each parent centred over its subtree
      (tidy-tree), so the apex sits centre-top instead of being left-anchored.
    - Spread tiers horizontally (drop the square-aspect row/band wraps) so the
      hierarchy reads wide instead of being squeezed into a tall column.
    - Band sibling zones by their real BFS depth (not the sink-bumped depth), so
      buildings at the same tier sit side by side instead of one being stranded a
      band higher.

    Untyped (discovered/TTDB) graphs are unchanged — every new path is gated behind
    a "typed inventory" check.

- 4639a38: Make "a wire terminates ON its ports" a construction-time guarantee. Routed
  polylines used to detach from their ports whenever the corridor allocator
  shifted a vertical run — the shift was added to the terminal points too —
  and their point order was upper-port-first rather than from→to, silently
  breaking direction-sensitive consumers (weathermap lane direction, endpoint
  labels). Routes now exist only through the router's `emitRoute()`, which pins
  both terminals to the edge's own ports, normalizes direction to from→to, and
  reconnects shifted runs with 45° diagonals; port re-seating refreshes every
  edge's 2-point geometry (previously only couplings). The invariant is
  registered as the blocking `port-attachment` constraint (the registry's first
  incidence constraint) with a `findDetachedTerminals` finder, and the dead
  `checkLayoutInvariants` aggregate now delegates to `verifyLayoutConstraints`
  (deprecated).
- d2051be: Add optional `entities` field to `SnapshotEntry` for registry-driven clustering.

  `resolve()` now accepts per-source entity ids (from `entity_element`) and uses them
  as first-class cluster keys: two nodes carrying the same entity id always fold into
  one cluster regardless of identity-key overlap or disjointness. Identity-key matching
  is preserved as a fallback for entity-less members (overlay, ghost, old data). Inputs
  without `entities` maps produce identical output to the previous algorithm.

- e5c79a4: Add `validateTopologyIdentityContract` to plugin-kit.

  Exports a pure helper that checks whether a `NetworkGraph` from a
  topology-emitting plugin satisfies the identity contract the entity registry
  relies on: every node must carry at least one network identity key
  (mgmtIp / chassisId / sysName / vendorIds), and every port that is
  link-endpoint-referenced or carries an explicit identity field must have
  `identity.ifName` (or rely on the contribution-store's `portIdentityWithIfNameFallback`).

  This is the `host-branch-guard`-style guard called for in #569 — a helper +
  test assertions, not a framework. In-tree topology plugins (Zabbix, NetBox)
  now assert their generated graphs pass the validator in their unit tests.

- 2e27e77: Remove the `lateral-ramp` routing grammar. PR #625 replaced the redundancy wire notation with the glasses hull plus a normal link, but the router kept its own under-loop notation for same-tier peer links, so two notations described one idea. The surviving one also broke on close ports: its fixed 14px stubs overshoot each other when the two ports are less than 28px apart, producing a self-crossing path. Peer edges now fall through to the default port-anchored bezier.
- caf0c50: fix(layout): a port with no label no longer crashes layout/render

  A link that referenced a bare interface name on a node that never enumerated
  the port yielded a `ResolvedPort`/`NodePort` with `label: undefined`, crashing
  the layout and SVG renderer (`port.label.trim()` in the flat-tree engine,
  composite router, port-geometry, and SvgPort). The flat-tree `PortInfo` now
  defaults a missing label to `''`, the resolver's `foldPortCluster` falls back
  to the interface name, and the `.trim()` sites are null-safe. Surfaced by
  merging the Arista CV-CUE topology (AP↔switch links) onto a NetBox topology.

- caf0c50: fix(layout): seat multi-link ports once, toward the mean of their peers

  The composite router's port-seating loop assumes 1 port = 1 link, so a port
  wired into several links (LLDP reporting many devices behind one switch port,
  breakouts) was re-seated once per edge with last-writer-wins — its face
  flip-flopped with edge order and the losing edges dropped out of the
  octilinear router into long Bezier curves. Shared ports are now seated once,
  toward the mean of their peers' centers, and pinned.

- a8370b8: Stop treating link bandwidth as a hierarchy signal when every link runs at the
  same speed. On a uniform fabric — a campus access layer where each AP has an
  identical 1G uplink — the "most peripheral end of the fattest trunk" rule
  selected every node and then resolved to a leaf, seeding the rank root at an
  access point and rendering switches below or beside the APs they serve. The
  rule now requires the fat-trunk set to actually be a subset of the candidates;
  otherwise the device-tier rule decides, which already refuses to root at a leaf.
- 091471f: Fix the Node file resolver under ESM, and add a dedicated `@shumoku/core/parser/node` export.
