---
'@shumoku/core': patch
---

Make "a wire terminates ON its ports" a construction-time guarantee. Routed
polylines used to detach from their ports whenever the corridor allocator
shifted a vertical run — the shift was added to the terminal points too —
and their point order was upper-port-first rather than from→to, silently
breaking direction-sensitive consumers (weathermap lane direction, endpoint
labels). Routes now exist only through the router's `emitRoute()`, which pins
both terminals to the edge's own ports, normalizes direction to from→to, and
reconnects shifted runs with 45° diagonals; port re-seating refreshes every
edge's 2-point geometry (previously only couplings). The invariant is
registered as the blocking `port-attachment` constraint (the registry's first
incidence constraint) with a `findDetachedTerminals` finder, and the dead
`checkLayoutInvariants` aggregate now delegates to `verifyLayoutConstraints`
(deprecated).
