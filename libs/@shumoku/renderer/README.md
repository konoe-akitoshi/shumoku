# @shumoku/renderer

Interactive [Svelte](https://svelte.dev) renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku) diagrams. Provides the building blocks for a live, manipulable topology view — pan/zoom camera, coordinate helpers, layout serialization, and overlay hooks — used by the [editor](../../../apps/editor) and the [server](../../../apps/server) web UI.

> Requires Svelte 5 (peer dependency). For static, non-interactive SVG output use [`@shumoku/renderer-svg`](../renderer-svg) instead.

## Install

```bash
npm install @shumoku/renderer @shumoku/core svelte
```

## What it provides

| Area | Exports |
|------|---------|
| **Camera** | `attachCamera` (opt-in pan/zoom), `Camera`, `CameraOptions`, `PanFilter` |
| **Serialization** | `layoutToJson` / `jsonToLayout`, `serializeLayout` / `deserializeLayout`, `SerializedLayout` — save and restore manual layout edits |
| **Colors** | `themeToColors` — turn a Shumoku theme into a resolved color map |
| **SVG coordinates** | `screenToSvg`, `svgToScreen`, `svgPointToContainer`, `svgRectToContainer`, `bezierEdgePath`, `bezierOffsetPath`, `computePortLabelPosition`, `getNodeLabel`, `getVlanStroke` |
| **Overlays** | typed snippet hooks for custom node / link / port / subgraph rendering (`RendererOverlaySnippets`) |
| **Static SVG** | `renderGraphToSvg`, `renderSvgString` — server-side / SSR fallback |

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
