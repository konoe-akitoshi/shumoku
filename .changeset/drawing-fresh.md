---
'@shumoku/core': patch
'@shumoku/renderer': patch
---

Add `layoutDrawing`, a new drawing layout that takes the network, its structure and the kit's metrics and returns a scene: heights from the flows and level pairs alone, frames as boxes around what they hold, sibling frames stacked only where the flows put one upstream of the other (`stackOrder` chooses whether the shape or the room wasted decides how far), and lines routed around cards with ports, parallel bundles ordered together by where their lines part, and room asked back from the wiring; lines laid over the drawing ask for none and may run round the outside. `sceneReport` measures a scene. The kit's drawing metrics gain `portSlot`.
