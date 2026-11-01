---
"@shumoku/core": patch
---

The drawing now decides the order of parallel lines from how their ends relate (which side each must pass), and updates it locally when a line moves, instead of re-sorting every lane.
