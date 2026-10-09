---
'@shumoku/core': minor
---

Add topology and presentation storage contracts and pure split/combine functions for node diagram position and display size. Existing Node/NetworkGraph consumers continue to use a composed runtime value; stored topology nodes exclude these two fields. Presentation values and references are validated, and conversion preserves structural and physical data without mutating the source.
