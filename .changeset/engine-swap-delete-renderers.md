---
"@shumoku/renderer": minor
"@shumoku/renderer-svg": minor
"@shumoku/renderer-png": minor
"shumoku": minor
---

The old renderers are removed: `SVGRenderer` / `svg.render` and the `@shumoku/renderer-svg/legacy` subpath, `prepareRender`, `PreparedRender`, icon dimension resolution (`collectIconUrls`, `resolveAllIconDimensions`, `fetchImageDimensions`), the `RenderMode` / `HTMLRendererOptions` / device and link info types, `@shumoku/renderer/resolved-static` (`renderSvgString`), `png.renderResolved`, and the old `ShumokuRenderer` components with `themeToColors`, the layout serialization helpers and the Bezier path helpers. `@shumoku/renderer-svg` keeps `renderNetworkSvg`, `drawNetworkScene`, `renderSceneSvg`, `renderGraphToSvg`, the icon fetch used by PNG, and the HTML page's theme variables. The `shumoku` package re-exports those instead.
