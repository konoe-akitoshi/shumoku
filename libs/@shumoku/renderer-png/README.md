# @shumoku/renderer-png

PNG renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Rasterizes canonical static SVG output from [`@shumoku/renderer`](../renderer) with [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js). Legacy graph/prepared entry points remain compatible with `@shumoku/renderer-svg` while consumers migrate.

> **Node.js only** — depends on the native `@resvg/resvg-js` binding, so it does not run in the browser.

## Install

```bash
npm install @shumoku/renderer-png @shumoku/core
```

## Quick start

```typescript
import { writeFileSync } from 'node:fs'
import { YamlParser } from '@shumoku/core'
import { renderGraphToPng } from '@shumoku/renderer-png'

const { graph } = new YamlParser().parse(yaml)

const png = await renderGraphToPng(graph, { scale: 2 }) // → Buffer
writeFileSync('diagram.png', png)
```

## API

| Function | Description |
|----------|-------------|
| `renderGraphToPng(graph, options?)` | `async` → `Buffer`. Canonical graph path: computes `ResolvedLayout` and renders the shared static SVG |
| `renderPng(prepared, options?)` | `async` → `Buffer`. Deprecated compatibility API for an existing legacy `PreparedRender` |
| `png.renderResolved(layout, options?)` | `async` → `Buffer`. Canonical path for an existing `ResolvedLayout`; supports `theme` and `scale` |

`PNGRenderOptions` supports `scale` (default `2`), `theme`, `loadSystemFonts`, and `iconTimeout`. If `theme` is omitted, `renderGraphToPng` honors `graph.settings.theme` and otherwise uses the light theme. External CDN icons are automatically embedded as base64 before rasterizing.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
