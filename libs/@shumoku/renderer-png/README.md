# @shumoku/renderer-png

PNG renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Renders the [`@shumoku/renderer-svg`](../renderer-svg) output to a raster image with [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js).

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
| `renderGraphToPng(graph, options?)` | `async` → `Buffer`. Convenience: `prepareRender` + `renderPng` |
| `renderPng(prepared, options?)` | `async` → `Buffer`. Renders an existing `PreparedRender` |

`PNGRenderOptions` has a single field, `scale` (default `2`), the output resolution multiplier. External CDN icons are automatically embedded as base64 before rasterizing.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
