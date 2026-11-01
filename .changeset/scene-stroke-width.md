---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

The drawing scene's wires carry both the width a line is drawn at (`stroke`) and the room it takes (`width`), and `DrawingMetrics.line(link)` replaces `width(link)`; the renderer's kit draws core's scene type instead of a copy, and no longer takes `captionAt` or a group `outline`, which nothing set. A double line is two lines of the stroke with one stroke of white between (a band of three strokes), and its white is the theme background. A speed below the slowest standard's is drawn a stroke wide, not nothing.
