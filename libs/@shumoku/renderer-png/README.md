# @shumoku/renderer-png

PNG renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Rasterizes the SVG [`@shumoku/renderer`](../renderer) draws with [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js).

> **Node.js only** — depends on the native `@resvg/resvg-js` binding, so it does not run in the browser.

## Install

```bash
npm install @shumoku/renderer-png @shumoku/core
```

## Quick start

```typescript
import { writeFileSync } from 'node:fs'
import { readNetworkModel } from '@shumoku/core'
import { renderNetworkPng } from '@shumoku/renderer-png'

const png = await renderNetworkPng(readNetworkModel(yaml), { scale: 2 }) // → Buffer
writeFileSync('diagram.png', png)
```

## API

| Function | Description |
|----------|-------------|
| `renderNetworkPng(model, options?)` | `async` → `Buffer`. Draws the model and rasterizes the SVG |
| `renderGraphToPng(graph, options?)` | `async` → `Buffer`. Same, for a `NetworkGraph` |
| `renderSvgToPng(svg, options?)` | `async` → `Buffer`. Rasterizes an SVG string already drawn |

Options: `scale` (default `2`), `theme`, `loadSystemFonts`, and `iconTimeout`. If `theme` is omitted the model's own theme is used, else light. External CDN icons are automatically embedded as base64 before rasterizing.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
