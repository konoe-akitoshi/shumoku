---
'@shumoku/core': patch
'@shumoku/renderer': patch
---

Add `layoutDrawing`, a new drawing layout that takes the network, its structure and the kit's metrics and returns a scene: heights from the flows and level pairs alone, frames as boxes around what they hold, and lines routed around cards with ports, parallel bundles and room asked back from the wiring. `sceneReport` measures a scene. The kit's drawing metrics gain `portSlot`.
