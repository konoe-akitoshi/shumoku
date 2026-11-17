---
"@shumoku/renderer": patch
---

The camera has `setTransform({ x, y, k })`, which sets translation and scale together. Restoring a view by `panTo` then `zoomTo` moved it, since `zoomTo` scales about the centre.
