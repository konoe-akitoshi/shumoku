---
'@shumoku/renderer-html': minor
---

**Interactive HTML around the new engine's SVG, one page for the whole network.**

- `renderHtml(model, options)` draws a model. `renderSceneHtml(scene)` wraps a drawn scene, and `renderGraphToHtml(graph)` still takes a graph. All three are synchronous. The options are `theme` (`'light' | 'dark'`), `title`, `branding` and `toolbar`. To use drawing options such as `base` or `text`, draw the SVG yourself and wrap it with `render(svg)`.
- **Removed:** sheets and multi-sheet navigation, namely `renderHierarchical`, `renderHtmlHierarchical`, `renderGraphToHtmlHierarchical`, `SheetData`, `SheetInfo` and `NavigationState`.
- Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.
