# shumoku

[![npm version](https://img.shields.io/npm/v/shumoku.svg)](https://www.npmjs.com/package/shumoku)

The all-in-one package for [Shumoku](https://github.com/konoe-akitoshi/shumoku) — network topology visualization for Markdown and the web. Re-exports [`@shumoku/core`](../@shumoku/core) (models, parser, layout, themes) plus the HTML renderer, so most apps only need this one dependency.

## Install

```bash
npm install shumoku
```

## Quick start

```typescript
import { YamlParser, renderGraphToHtml } from 'shumoku'

const { graph } = new YamlParser().parse(`
name: Edge
nodes:
  - { id: rt-01, type: router, vendor: yamaha }
  - { id: sw-01, type: l3-switch }
links:
  - from: { node: rt-01, port: lan1 }
    to:   { node: sw-01, port: ge-0/0/0 }
    bandwidth: 10G
`)

// Interactive HTML (pan / zoom / tooltips)
const html = await renderGraphToHtml(graph, { title: 'Edge', toolbar: true })
```

## What you get

- **Everything in `@shumoku/core`** — `YamlParser`, `HierarchicalParser`, `computeNetworkLayout`, models, `lightTheme` / `darkTheme`, the plugin kit, and plugin types.
- **HTML rendering** — `renderGraphToHtml`, `renderHtml`, hierarchical variants, `initInteractive`, and the `INTERACTIVE_IIFE` bundle for embedding.
- **SVG access** — the `svg` namespace re-exported from [`@shumoku/renderer-svg`](../@shumoku/renderer-svg) (`svg.renderGraphToSvg`, `svg.prepareRender`, …).

Need standalone SVG or PNG output? Depend on the dedicated renderers directly:

```typescript
import { renderGraphToSvg } from '@shumoku/renderer-svg'
import { renderGraphToPng } from '@shumoku/renderer-png' // Node.js only

const svg = await renderGraphToSvg(graph)
const png = await renderGraphToPng(graph, { scale: 2 })
```

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
