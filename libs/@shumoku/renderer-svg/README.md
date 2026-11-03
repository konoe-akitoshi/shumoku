# @shumoku/renderer-svg

SVG output for [Shumoku](https://github.com/konoe-akitoshi/shumoku): a model drawn by the drawing engine and rendered with the kit of [`@shumoku/renderer`](../renderer) as a standalone SVG string. The same drawing backs the CLI, HTML, PNG, server exports and the editor.

## Install

```bash
npm install @shumoku/renderer-svg @shumoku/core
```

## Quick start

```typescript
import { readNetworkModel } from '@shumoku/core'
import { renderNetworkSvg } from '@shumoku/renderer-svg'

const svg = renderNetworkSvg(readNetworkModel(yaml), { theme })
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
