# @shumoku/renderer-svg

SVG renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Provides the **unified render pipeline** — layout, icon-dimension resolution, and SVG generation — and is the foundation that [`@shumoku/renderer-html`](../renderer-html) and [`@shumoku/renderer-png`](../renderer-png) build on.

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
| `renderSvg(prepared, options?)` | → SVG string |
| `renderGraphToSvg(graph, options?)` | Convenience: `prepareRender` + `renderSvg` |
| `renderEmbeddable(prepared, options?)` | → `{ svg, css, … }` for embedding in a web app with scoped styles |

All four are `async` (icon resolution may fetch over the network).

### Icon utilities

`resolveAllIconDimensions`, `fetchIconAsDataUrl`, `fetchImageDimensions`, `clearIconCache`, `DEFAULT_ICON_FETCH_TIMEOUT`, and `collectIconUrls` are exported for callers that manage icon fetching themselves (e.g. a server resolving dimensions ahead of time).

> The removed class-based API (`new SvgRenderer()`) is gone. A lower-level `SVGRenderer` is still exported for advanced use, but prefer the pipeline functions above.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
