# @shumoku/renderer

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
- eb1f58e: Balance the drawing: a box with room to spare now stands in the middle of it instead of at the left edge, and every box is drawn weakly towards the middle of the boxes it hands over to (and is handed over by).
  
  A switch with many terminals no longer draws them in one very wide row: a fan of more than six boxes folds into rows of at most five, the later rows one rank lower and standing under the first as one block.
  
  A group with no group inside it is now drawn compactly on its own and set into its parent as one box, so a wide group no longer spreads across the whole drawing.
- 2db8b4e: Show port names the way a device prints them in its brief listings (`TenGigabitEthernet1/0/1` as `Te1/0/1`, `Ethernet1/49` as `Et1/49`). Only the chip text is shortened: the stored name never changes, and the full name is the port's tooltip (an SVG `<title>`). Names that would show alike within one box keep their full spelling, and the spacing of the ports follows the shown names, so boxes with long Cisco-, Arista- or H3C-style port names come out narrower.
- bcefedd: When the names of the ports on one edge ask for more room than the edge may have, write the start they share once. `Metrics.portSides` may return a `caption` for an edge (the common prefix, cut at a token boundary: `Te1/0/`), and the scene lists it in `captions` with the corner the edge starts from. The renderer draws it as a bold chip at that corner and leaves it off each port's own chip; every port still carries its full `name`, which is its tooltip.
- 3967c02: As the last resort for port names that still do not fit an edge, cut the front of the names (`…0/52`): one length for the whole edge, the longest that fits, lengthened while two names would read alike. A chip on a left or right edge is held to 14 characters. The port's tooltip keeps the full name.
- 317dd26: Space ports by their neighbours instead of by the widest name in the box. `Metrics.portSlot(labels)` is replaced by `Metrics.portSides(box)`, which answers for each edge of a box the text of every chip, the least distance between each neighbouring pair (and a pair one apart), the margins at the ends and how far the names reach out. A top or bottom edge asks for half of each chip's width between neighbours; a left or right edge asks for the chip's height only, so a long name no longer stretches the side of a box. Scene ports now carry `name` (the stored name, in full) and `label` (what is written in the chip); the renderer draws `label` and puts `name` in the tooltip.
- e5d6270: Set the port names of a long top or bottom edge in two rows when one row would widen the box. A port in `PortSideLayout` may stand in row 1, every other chip of the edge, and a pair two ports apart may ask for a distance of its own (`gaps` with `to - from` of 2). The scene's ports carry the `row`, and the renderer draws the outer row one chip farther out. A side's `depth` is now how far the outer edge of its outermost chip stands from the port; where that is more than the lead-out, the room between ranks, and between a box and the line that passes it, grows by the difference.
- b7f7d80: Lines are drawn one and a half times as wide: each decade of speed adds a stroke and a half (1G at 4.5, 10G at 6, 100G at 7.5), so a drawing shrunk to fit still shows its lines and tells their speeds apart.
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

## 0.3.2

### Patch Changes

- 1424124: Draw hosting as containment: a host is drawn as one box holding the VMs on it (its own card as the heading, the VMs in a grid below), and a cluster named as a host as a frame round its nodes and those VMs, as vSphere, Proxmox and cloud diagrams do. The host is still the node: its ports sit on the box's edge.
- 9b14755: Selection outline and marquee styles now come from the kit's tokens (`tokens.selection`) instead of literals; add a dev-only UI kit catalog page (`bun run catalog`).
- Updated dependencies [1424124]
  - @shumoku/core@0.6.1

## 0.3.1

### Patch Changes

- 5bece3c: A line's colour now names one VLAN, and the colours are worked out rather than listed.
  
  - **What is coloured.** A line carrying a single VLAN is drawn in that VLAN's colour, so the links of one VLAN can be followed by it. A trunk, which carries several VLANs, is drawn in the plain line colour; its caption lists what it carries. Before, every distinct set of VLANs got a colour of its own, so a trunk's colour named nothing.
  - **Where the colours come from.** A theme now has `colors.lineTone`: an OKLCH lightness, the most chroma it allows, and a starting hue. The colours follow from it. The hues are spaced evenly, at the least chroma that keeps them apart, so a few VLANs are soft and more of them a little more vivid.
  - **What every colour meets.** Contrast of at least 3:1 against every background a line can lie on (WCAG 2.1 non-text contrast), and four just-noticeable differences in OKLab from every other colour.
  - **When there are more VLANs than that.** If a diagram has more single-VLAN VLANs than the tone can tell apart (7 in the light theme, 9 in the dark), none is coloured: a colour shared by two VLANs would say they are one.
  - **New exports.** `lineColors`, `lineColorCapacity`, `fittingLineTone` (works out a tone from a new theme's backgrounds), `toneFits`, `contrastRatio`, `hueOf` and `oklchToHex`.
  - **Removed.** `colors.vlans` is gone.
- Updated dependencies [173780d]
- Updated dependencies [62252ae]
- Updated dependencies [5bece3c]
  - @shumoku/core@0.6.0

## 0.3.0

### Minor Changes

- 6f89ee5: **The renderer draws the new engine's `Scene`.** It no longer lays anything out.
  
  - `drawNetworkScene(model, options)` draws a model with the kit's metrics. `drawingMetrics` and `createKit` are the metrics and text measurement behind it, and `Diagram` is the Svelte component that renders a scene.
  - `ShumokuRenderer` takes a `scene`. It reports a node or group drop through `ondrop`, so the Editor can store the drop as an order hint, never as a coordinate.
  - `@shumoku/renderer/static` is a plain-JS build, so Node and Bun can render without a Svelte plugin. It exports `renderNetworkSvg`, `renderSceneSvg` and `drawNetworkScene`.
  - Every element's look is defined once in the kit (card, port, caption, group, hull, wire). Colours are `Theme` fields (`port`, `hull`, `shadow`, `vlans`), and distinct VLAN sets in one diagram take distinct colours.
  - **Removed:** layout serialisation (`serializeLayout`, `deserializeLayout`, `layoutToJson`, `jsonToLayout`, `SerializedLayout`), the bezier helpers (`bezierEdgePath`, `bezierOffsetPath`), `renderSvgString`, `polylinePath`, `computePortLabelPosition`, `getNodeLabel`, `getVlanStroke`, `themeToColors` and `RenderColors`. `renderGraphToSvg` moved to `@shumoku/renderer-svg`.
  - **Fixed:** the package names `@shumoku/core` by version range. 0.1.5 declared `workspace:*` and could not be installed from npm.

### Patch Changes

- Updated dependencies [6f89ee5]
  - @shumoku/core@0.5.0

## 0.1.5

### Patch Changes

- 704357a: Sanitize inline SVG icons (`spec.icon`) before they are rendered, so an icon can't run script in the viewer's browser. `@shumoku/core` adds `sanitizeIconSvg` / `sanitizeIconSvgWith` (DOMPurify-based) and `@shumoku/renderer` sanitizes inline icons in its Svelte components and exports `sanitizeInlineIcon`. `@shumoku/renderer-svg` now escapes icon URLs in `<image href>`.
- Updated dependencies [9830a35]
- Updated dependencies [0e8b8b4]
- Updated dependencies [704357a]
  - @shumoku/core@0.4.2

## 0.1.4

### Patch Changes

- cbc429d: Update compatible runtime and build dependencies across published packages.
- 21edd20: Update the Svelte build plugin to version 7 for compatibility with Vite 8.
- 8af901c: Update the renderer build toolchain to Vite 8.
- Updated dependencies [cbc429d]
  - @shumoku/core@0.4.1

## 0.1.3

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0

## 0.1.2

### Patch Changes

- 053ca27: Derive the default maximum camera zoom from the graph and viewport dimensions so large diagrams can reach readable scale. Preserve explicit zoom bounds and the existing pan/zoom performance optimizations, and refresh dimensions on resize or sheet changes.
- Updated dependencies [78f6864]
  - @shumoku/core@0.3.1

## 0.1.1

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

- 368672f: Fix pan/zoom lag on large diagrams: cache the root CTM per wheel gesture (was forcing a synchronous reflow on every wheel event), coalesce viewport transform writes to one per animation frame, drop per-node feDropShadow filters and port/link labels while a camera gesture is active (`.camera-gesture` class on the svg, now also applied during drag pans), and stop re-applying the last wheel event when wheel-gestures delivers its gesture-end notification (zoomed one extra step ~400ms after scrolling stopped).
- 0e3bed0: add routePoints to LinkOverlayContext and polylineOffsetPath helper for weathermap lane rendering
- caf0c50: fix(layout): a port with no label no longer crashes layout/render

  A link that referenced a bare interface name on a node that never enumerated
  the port yielded a `ResolvedPort`/`NodePort` with `label: undefined`, crashing
  the layout and SVG renderer (`port.label.trim()` in the flat-tree engine,
  composite router, port-geometry, and SvgPort). The flat-tree `PortInfo` now
  defaults a missing label to `''`, the resolver's `foldPortCluster` falls back
  to the interface name, and the `.trim()` sites are null-safe. Surfaced by
  merging the Arista CV-CUE topology (AP↔switch links) onto a NetBox topology.

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
