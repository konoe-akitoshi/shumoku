# @shumoku/renderer

## 0.1.1

### Patch Changes

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
