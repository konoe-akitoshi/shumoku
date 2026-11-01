---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

A line keeps a ground as wide as itself: twins stand a line's width apart (white equal to the width), lines that part a row plus their widths, and a card a row plus the line's width. `DrawingMetrics.gapTwin` becomes `stroke` (the thinnest line's width, which the tolerance follows) and the kit's `space.twin` is gone.
