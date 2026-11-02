# @shumoku/renderer

Canonical renderer for [Shumoku](https://github.com/konoe-akitoshi/shumoku) diagrams. It provides both the live [Svelte](https://svelte.dev) renderer used by the editor and server UI, and a framework-free static SVG entry point used by CLI, PNG, and SSR consumers.

> The interactive entry requires Svelte 5. Static consumers should import `@shumoku/renderer/static`; it does not mount or compile a Svelte component.

## Install

```bash
npm install @shumoku/renderer @shumoku/core svelte
```

For static-only consumers, Svelte is not required at runtime:

```typescript
import { drawNetworkScene, renderNetworkSvg, renderSceneSvg } from '@shumoku/renderer/static'

const svg = renderNetworkSvg(model, { theme }) // draw a NetworkModel and render it
const scene = drawNetworkScene(model) // or keep the scene,
const again = renderSceneSvg(scene, { theme }) // and render it as often as needed
```

## What it provides

| Area | Exports |
|------|---------|
| **Viewer** | `ShumokuRenderer` (`@shumoku/renderer/components/ShumokuRenderer.svelte`): draws a `Scene` with selection, context menu, marquee and overlays |
| **Kit** | `Diagram`, `drawingMetrics`, `createKit`: the one component that draws a scene, interactive and static |
| **Drawing** | `drawNetworkScene`: a model drawn as a scene (browser and server) |
| **Camera** | `attachCamera` (opt-in pan/zoom), `Camera`, `CameraOptions`, `PanFilter` |
| **SVG coordinates** | `screenToSvg`, `screenToWorld`, `svgToScreen`, `svgPointToContainer`, `svgRectToContainer`, `polylineOffsetPath` (a lane beside a wire) |
| **Overlays** | typed snippet hooks for custom node / link / port / subgraph rendering (`RendererOverlaySnippets`); a link overlay gets the wire's polyline and corner radii |
| **Static SVG** | `renderNetworkSvg`, `renderSceneSvg`, `drawNetworkScene` from `@shumoku/renderer/static`: CLI, PNG, and SSR |

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
