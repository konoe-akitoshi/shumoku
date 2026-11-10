---
"@shumoku/core": patch
"@shumoku/renderer": patch
"@shumoku/cli": patch
---

Name the relative placement the drawing solves: `layoutNetwork(model)` returns `{ scene, arrangement }`, where `Arrangement` lists each frame's children left to right with the rows they hold, by id, and `unmet`, the order hints the structure overrode. `drawNetwork` now reads `drawing.order` from the model itself (the `hints` option is gone), and `resolveNetwork` carries it through the merge, so the Editor and the Server draw one model the same way. An order list is sparse: `pinned` moves only the named children that are out of the asked order, each to just after the one named before it, so a drag no longer displaces untouched siblings. Redundancy sets may be named by their id. `NetworkModel.sources`, which nothing read or wrote, is removed.
