---
'@shumoku/core': patch
'@shumoku/renderer': patch
---

Add `layoutDrawing`, a new drawing layout that takes the network, its structure and the kit's metrics and returns a scene: heights from the flows and level pairs alone, frames as boxes around what they hold, sibling frames always stacked where the flows put one upstream of the other, and lines routed around cards with ports, parallel bundles ordered together by where their lines part, and room asked back from the wiring; lines laid over the drawing ask for none and may run round the outside. Every end of a line stands at a port, named or not. What a virtual line leaves the network for (a space with no cable) stands above the cabled node it leaves, and what the structure gives no direction is reported as free. `sceneReport` and `wiringReport` measure a scene. The kit's drawing metrics gain `portSlot`.

The structure now also orients the cable-less vertices that no boundary point reaches, from the cabled vertices their virtual lines leave (each at distance 0): the cabled end is the nearer one. Lines between two cabled vertices still count on neither side.
