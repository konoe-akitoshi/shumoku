---
"@shumoku/core": patch
"@shumoku/renderer-svg": patch
---

Remove `thick` and `invisible` from `LinkType`: nothing produces them and the drawing does not draw them (a thick line is a wider speed, and an invisible one was drawn). A link of redundancy `stack` is drawn solid in the old renderer.
