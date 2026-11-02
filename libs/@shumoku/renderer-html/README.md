# @shumoku/renderer-html

Interactive HTML renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Wraps the SVG [`@shumoku/renderer`](../renderer) draws in a self-contained page with pan, zoom and tooltips. The whole network is one page; sheets were removed in the engine swap.

## Install

```bash
npm install @shumoku/renderer-html @shumoku/core
```

## Quick start

```typescript
import { readNetworkModel } from '@shumoku/core'
import { renderHtml } from '@shumoku/renderer-html'

const html = renderHtml(readNetworkModel(yaml), { title: 'My Network', toolbar: true })
```

## API

| Function | Description |
|----------|-------------|
| `renderHtml(model, options?)` | **sync**. Draw a `NetworkModel` as an interactive page |
| `renderSceneHtml(scene, options?)` | **sync**. The same for a scene already drawn |
| `renderGraphToHtml(graph, options?)` | **sync**. The same for a `NetworkGraph` |
| `render(svg, options?)` | **sync**. Wrap an SVG you drew yourself |

### Options (`HTMLRenderOptions`)

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Page / document title |
| `branding` | boolean | Show the Shumoku mark |
| `toolbar` | boolean | Show the pan/zoom toolbar |
| `theme` | `'light' \| 'dark'` | Override the model's own theme |

The generated SVG keeps the node, port and link data attributes the tooltip runtime reads.

### Embedding

The interactive behavior ships as an IIFE bundle. Use `getIIFE()` / `setIIFE()` / `INTERACTIVE_IIFE` to inline or supply it, and `initInteractive()` to wire up an already-rendered SVG in the browser.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
