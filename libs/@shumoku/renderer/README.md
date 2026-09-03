# @shumoku/renderer

Canonical renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku) diagrams. It provides both the live [Svelte](https://svelte.dev) renderer used by the editor and server UI, and a framework-free static SVG entry point used by CLI, PNG, and SSR consumers.

> The interactive entry requires Svelte 5. Static consumers should import `@shumoku/renderer/static`; it does not mount or compile a Svelte component.

## Install

```bash
npm install @shumoku/renderer @shumoku/core svelte
```

For static-only consumers, Svelte is not required at runtime:

```typescript
import { renderGraphToSvg, renderSvgString } from '@shumoku/renderer/static'

const svg = await renderGraphToSvg(graph)
const svgFromExistingLayout = renderSvgString(resolvedLayout, { theme })
```

## What it provides

| Area | Exports |
|------|---------|
| **Camera** | `attachCamera` (opt-in pan/zoom), `Camera`, `CameraOptions`, `PanFilter` |
| **Serialization** | `layoutToJson` / `jsonToLayout`, `serializeLayout` / `deserializeLayout`, `SerializedLayout` — save and restore manual layout edits |
| **Colors** | `themeToColors` — turn a Shumoku theme into a resolved color map |
| **SVG coordinates** | `screenToSvg`, `svgToScreen`, `svgPointToContainer`, `svgRectToContainer`, `bezierEdgePath`, `bezierOffsetPath`, `computePortLabelPosition`, `getNodeLabel`, `getVlanStroke` |
| **Overlays** | typed snippet hooks for custom node / link / port / subgraph rendering (`RendererOverlaySnippets`) |
| **Static SVG** | `renderGraphToSvg`, `renderSvgString` from `@shumoku/renderer/static` — CLI, PNG, and SSR |

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
