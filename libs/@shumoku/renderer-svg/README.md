# @shumoku/renderer-svg

SVG compatibility and pipeline package for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Its public pipeline functions render `ResolvedLayout` through the canonical [`@shumoku/renderer`](../renderer) static SVG implementation shared by CLI, HTML, PNG, server output, Editor export, and Playground. The older `LayoutResult` renderer remains available as an explicitly deprecated compatibility layer.

## Install

```bash
npm install @shumoku/renderer-svg @shumoku/core
```

## Quick start

```typescript
import { YamlParser } from '@shumoku/core'
import { prepareRender, renderSvg, renderGraphToSvg } from '@shumoku/renderer-svg'

const { graph } = new YamlParser().parse(yaml)

// One-liner
const svg = await renderGraphToSvg(graph)

// Or split the pipeline — `prepared` can feed SVG, HTML, and PNG renderers
const prepared = await prepareRender(graph) // resolves icon dimensions + computes layout
const svg2 = await renderSvg(prepared)
```

## Pipeline

| Function | Description |
|----------|-------------|
| `prepareRender(graph, options?)` | → `PreparedRender`. Resolves icon dimensions (CDN fetch + cache) and computes layout |
| `renderSvg(prepared, options?)` | → canonical SVG when `prepared.resolved` is available; legacy fallback otherwise |
| `renderGraphToSvg(graph, options?)` | Canonical graph-to-SVG convenience API |
| `renderEmbeddable(prepared, options?)` | → `{ svg, css, … }` for embedding in a web app with scoped styles |

All four are `async` (icon resolution may fetch over the network).

### Icon utilities

`resolveAllIconDimensions`, `fetchIconAsDataUrl`, `fetchImageDimensions`, `clearIconCache`, `DEFAULT_ICON_FETCH_TIMEOUT`, and `collectIconUrls` are exported for callers that manage icon fetching themselves (e.g. a server resolving dimensions ahead of time).

> `SVGRenderer` / `LegacySVGRenderer` and the synchronous `svg.render(graph, layout)` namespace API are deprecated compatibility surfaces for callers that only have the old `LayoutResult`. New code should use the pipeline functions above or `@shumoku/renderer/static` directly.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
