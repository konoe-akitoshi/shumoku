---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

Set the port names of a long top or bottom edge in two rows when one row would widen the box. A port in `PortSideLayout` may stand in row 1, every other chip of the edge, and a pair two ports apart may ask for a distance of its own (`gaps` with `to - from` of 2). The scene's ports carry the `row`, and the renderer draws the outer row one chip farther out. A side's `depth` is now how far the outer edge of its outermost chip stands from the port; where that is more than the lead-out, the room between ranks, and between a box and the line that passes it, grows by the difference.
