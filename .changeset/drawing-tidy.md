---
'@shumoku/core': patch
---

The drawing engine's order and geometry stages are split into their spec steps (`drawing/layers/`, `drawing/geometry/`), each taking only what it reads, and the drawing is pinned by a golden test. One rank is put above the next in one place, the rank bands, instead of once per flow as well: a row that a box hangs low in now keeps the next row clear of it, so a few small drawings come out slightly taller.
