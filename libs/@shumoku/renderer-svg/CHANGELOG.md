# @shumoku/renderer-svg

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
