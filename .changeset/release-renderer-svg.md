---
'@shumoku/renderer-svg': minor
---

**A thin wrapper over `@shumoku/renderer/static`.** The SVG is drawn by the new drawing engine.

- `renderNetworkSvg(model, options)` draws a model to a standalone SVG string. `renderSceneSvg(scene)` and `drawNetworkScene(model)` are re-exported, and `renderGraphToSvg(graph)` still takes a graph. The `theme` option is a `Theme` object such as `darkTheme`, not a string.
- The icon fetch helpers and `generateThemeCSS` stay.
- **Removed:** the old pipeline and renderer, namely `prepareRender`, `renderSvg`, `renderEmbeddable`, `SVGRenderer`, `LegacySVGRenderer`, the `svg` namespace, `resolveAllIconDimensions`, `collectIconUrls`, `fetchImageDimensions` and their option types. Draw with `renderNetworkSvg`.
- Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.
