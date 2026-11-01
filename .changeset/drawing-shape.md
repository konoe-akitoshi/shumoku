---
'@shumoku/core': patch
'@shumoku/renderer': patch
---

The drawing's lines are shaped after they are placed: each right-angled corner is cut into a 45° chamfer as far as what lies inside it allows (the port's lead-out, the nearest crossing, the white to boxes, the pitch to other lines), the vertices are rounded with arcs, and a bundle turning together is rounded concentrically. A scene's wires carry a `radii` for each vertex, and `marks` say where a line enters or leaves a band of lines (read from the order at the doors). The kit draws wires with those radii and takes `markStyle` ('A' to 'E', default 'B', the chamfer itself) to draw the candidate marks. The drawing report measures 45° segments across the line.
