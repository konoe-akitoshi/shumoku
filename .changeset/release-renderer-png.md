---
'@shumoku/renderer-png': minor
---

**PNG from the new engine's SVG.**

- `renderNetworkPng(model, options)` draws a model and rasterises it with resvg. `renderSvgToPng(svg, options)` rasterises an SVG string you already have, and `renderGraphToPng(graph)` still takes a graph. `scale` defaults to 2.
- **Removed:** `renderPng(prepared)` and its option types (`PNGRenderOptions`, `PNGGraphRenderOptions`). Use `renderNetworkPng` or `renderSvgToPng`.
- Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.
