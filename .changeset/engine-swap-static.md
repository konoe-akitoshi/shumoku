---
"@shumoku/core": patch
"@shumoku/renderer": minor
"@shumoku/renderer-svg": minor
"@shumoku/renderer-png": minor
"@shumoku/cli": patch
---

Static SVG and PNG output is drawn by the new drawing engine: `drawNetwork(model)` in core, `renderNetworkSvg` / `renderNetworkPng` for models, and `renderGraphToSvg` / `renderGraphToPng` still take a graph. `@shumoku/renderer/static` is now a plain-JS build the kit; the old resolved-layout renderer moved to `@shumoku/renderer/resolved-static`. `renderSvg`, `renderEmbeddable`, `renderPng(prepared)` and the old `png.render` are removed.
