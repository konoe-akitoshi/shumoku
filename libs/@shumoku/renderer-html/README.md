# @shumoku/renderer-html

Interactive HTML renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku). Wraps the [`@shumoku/renderer-svg`](../renderer-svg) pipeline to produce a self-contained HTML page with pan, zoom, tooltips, and — for large networks — multi-sheet navigation.

## Install

```bash
npm install @shumoku/renderer-html @shumoku/core
```

## Quick start

```typescript
import { YamlParser } from '@shumoku/core'
import { renderGraphToHtml } from '@shumoku/renderer-html'

const { graph } = new YamlParser().parse(yaml)

const html = await renderGraphToHtml(graph, { title: 'My Network', toolbar: true })
```

## API

| Function | Description |
|----------|-------------|
| `renderGraphToHtml(graph, options?)` | `async` — parse-to-HTML convenience |
| `renderGraphToHtmlHierarchical(graph, options?)` | `async` — convenience with sheet navigation |
| `renderHtml(prepared, options?)` | **sync** — render a `PreparedRender` to HTML |
| `renderHtmlHierarchical(prepared, options?)` | `async` — render with sheets |

### Options (`HTMLRenderOptions`)

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Page / document title |
| `branding` | boolean | Show the Shumoku mark |
| `toolbar` | boolean | Show the pan/zoom toolbar |
| `sheets` | `Map<string, SheetData>` | Pre-computed hierarchical sheets (skips recomputation) |

### Embedding

The interactive behavior ships as an IIFE bundle. Use `getIIFE()` / `setIIFE()` / `INTERACTIVE_IIFE` to inline or supply it, and `initInteractive()` to wire up an already-rendered SVG in the browser.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
