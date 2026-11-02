---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

Define a drawn wire's look in one place (`wireLook`): colour, stroke and a dash given as multiples of the line's own stroke, so a thick line keeps the look of a thin one. The double wire is gone from the new drawing, and the scene's wire carries one width, `stroke`, which is also the room it takes across (`Metrics.line` returns it).
