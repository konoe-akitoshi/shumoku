---
"@shumoku/renderer-html": minor
"shumoku": minor
"@shumoku/cli": patch
---

HTML output is the drawn SVG in a standalone page: `render(svg, options)`, `renderHtml(model)`, `renderSceneHtml(scene)` and `renderGraphToHtml(graph)`. Hierarchical sheets (`renderHierarchical`, `renderHtmlHierarchical`, navigation) are removed in the engine swap; nested groups are drawn together on one page. `shumoku render --format html` uses the drawing engine.
