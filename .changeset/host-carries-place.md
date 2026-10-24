---
"@shumoku/core": patch
---

A node with a `host` can no longer be given a `group`: it is where its host is, so the place is written on the host (or on the redundancy set's nodes). Reading refuses the pair, drawing and merging no longer write a group onto a hosted node, and `applyGraphEdits` keeps the host and drops a group the drawing gave it.
