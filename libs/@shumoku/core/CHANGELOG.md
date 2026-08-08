# @shumoku/core

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
- b19c2ec: Add a layout problem IR, semantic diagnostics for role-driven layout invariants, and routing intents that gate peer ramps, gutters, and bus grammars.
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
