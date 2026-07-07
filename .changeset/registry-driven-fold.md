---
'@shumoku/core': patch
---

Add optional `entities` field to `SnapshotEntry` for registry-driven clustering.

`resolve()` now accepts per-source entity ids (from `entity_element`) and uses them
as first-class cluster keys: two nodes carrying the same entity id always fold into
one cluster regardless of identity-key overlap or disjointness. Identity-key matching
is preserved as a fallback for entity-less members (overlay, ghost, old data). Inputs
without `entities` maps produce identical output to the previous algorithm.
