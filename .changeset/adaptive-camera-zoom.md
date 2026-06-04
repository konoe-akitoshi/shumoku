---
'@shumoku/renderer': patch
---

Derive the default maximum camera zoom from the graph and viewport dimensions so large diagrams can reach readable scale. Preserve explicit zoom bounds and the existing pan/zoom performance optimizations, and refresh dimensions on resize or sheet changes.
