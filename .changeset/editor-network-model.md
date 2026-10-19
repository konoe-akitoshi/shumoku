---
"@shumoku/core": minor
---

A redundancy set in the network YAML may name its `kind` (ha, vc, vss, vpc, mlag or stack). The model's design layer keeps a node's catalog `spec` snapshot and a link's designed `cable` (medium, grade, product), and its drawing layer keeps a group's sheet (`file`, `pins`). `toNetworkGraph` gives every node the ports its links name, reads a link end's address from the segments it carries and a cable name such as `cat6` or `om4` as a grade, and leaves out a rate the ends' module standards already name, so a graph round-trips through `fromNetworkGraph` and back without loss. Group bounds are no longer kept in the drawing layer.
