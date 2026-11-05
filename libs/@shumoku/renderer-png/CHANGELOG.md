# @shumoku/renderer-png

## 0.3.1

### Patch Changes

- Updated dependencies [173780d]
- Updated dependencies [62252ae]
- Updated dependencies [5bece3c]
  - @shumoku/core@0.6.0
  - @shumoku/renderer@0.3.1
  - @shumoku/renderer-svg@0.3.1

## 0.3.0

### Minor Changes

- 6f89ee5: **PNG from the new engine's SVG.**
  
  - `renderNetworkPng(model, options)` draws a model and rasterises it with resvg. `renderSvgToPng(svg, options)` rasterises an SVG string you already have, and `renderGraphToPng(graph)` still takes a graph. `scale` defaults to 2.
  - **Removed:** `renderPng(prepared)` and its option types (`PNGRenderOptions`, `PNGGraphRenderOptions`). Use `renderNetworkPng` or `renderSvgToPng`.
  - Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.

### Patch Changes

- Updated dependencies [6f89ee5]
- Updated dependencies [6f89ee5]
- Updated dependencies [6f89ee5]
  - @shumoku/core@0.5.0
  - @shumoku/renderer-svg@0.3.0
  - @shumoku/renderer@0.2.0

## 0.2.28

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0
  - @shumoku/renderer@0.1.3
  - @shumoku/renderer-svg@0.2.28

## 0.2.27

### Patch Changes

- bbc9212: Isolate the deprecated LayoutResult SVG renderer behind an explicit legacy compatibility boundary.
- Updated dependencies [bbc9212]
  - @shumoku/renderer-svg@0.2.27

## 0.2.26

### Patch Changes

- 581e351: Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.
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
  - @shumoku/renderer-svg@0.2.26
