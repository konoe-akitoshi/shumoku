---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

Space ports by their neighbours instead of by the widest name in the box. `Metrics.portSlot(labels)` is replaced by `Metrics.portSides(box)`, which answers for each edge of a box the text of every chip, the least distance between each neighbouring pair (and a pair one apart), the margins at the ends and how far the names reach out. A top or bottom edge asks for half of each chip's width between neighbours; a left or right edge asks for the chip's height only, so a long name no longer stretches the side of a box. Scene ports now carry `name` (the stored name, in full) and `label` (what is written in the chip); the renderer draws `label` and puts `name` in the tooltip.
