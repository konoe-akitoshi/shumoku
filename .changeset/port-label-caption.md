---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

When the names of the ports on one edge ask for more room than the edge may have, write the start they share once. `Metrics.portSides` may return a `caption` for an edge (the common prefix, cut at a token boundary: `Te1/0/`), and the scene lists it in `captions` with the corner the edge starts from. The renderer draws it as a bold chip at that corner and leaves it off each port's own chip; every port still carries its full `name`, which is its tooltip.
