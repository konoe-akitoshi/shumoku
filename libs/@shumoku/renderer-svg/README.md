# @shumoku/renderer-svg

SVG output for [Shumoku](https://github.com/konoe-akitoshi/shumoku). This package is a thin wrapper: it re-exports `renderNetworkSvg`, `renderSceneSvg` and `drawNetworkScene` from `@shumoku/renderer/static` (a model drawn by the drawing engine and rendered with the kit of [`@shumoku/renderer`](../renderer) as a standalone SVG string), and adds `renderGraphToSvg` and the icon fetch helpers. The same drawing backs the CLI, HTML, PNG, server exports and the editor.

## Install

```bash
npm install @shumoku/renderer-svg @shumoku/core
```

## Quick start

```typescript
import { darkTheme, readNetworkModel } from '@shumoku/core'
import { renderNetworkSvg } from '@shumoku/renderer-svg'

// `theme` is a Theme object (`lightTheme`, `darkTheme`, ...), not a string.
// When absent, the model's own drawing setting decides, then light.
const svg = renderNetworkSvg(readNetworkModel(yaml), { theme: darkTheme })
```

## API

| Function | Description |
|----------|-------------|
| `renderNetworkSvg(model, options?)` | A `NetworkModel` drawn and rendered as an SVG string |
| `drawNetworkScene(model, options?)` | The scene (`Scene`): where every box and line stands |
| `renderSceneSvg(scene, options?)` | A scene already drawn, as an SVG string |
| `renderGraphToSvg(graph, options?)` | `async`. A `NetworkGraph` through the same path, in the graph's theme |

`fetchIconAsDataUrl`, `clearIconCache` and `DEFAULT_ICON_FETCH_TIMEOUT` are exported for callers that embed URL icons themselves (the PNG renderer does).

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
