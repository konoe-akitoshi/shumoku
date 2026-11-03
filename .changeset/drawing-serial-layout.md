---
"@shumoku/core": patch
---

Drawing layout rebuilt as a serial pipeline: ranks, left-to-right order, corridors, routes, the order of lines in each corridor and then the coordinates, each decided from relations before any length is read. Boundary points are read in the order they are written, a network with none takes the places where the physical meets the virtual, and `layoutDrawing` takes optional `DrawHints` (`siblings`) to fix the order of children of a frame.
