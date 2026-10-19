---
"@shumoku/core": minor
---

Add `resolveNetwork`, which merges the project's `NetworkModel` with each source's `SourceNetwork` into one `NetworkModel` of the same shape: nodes clustered by identity or registry entity, fields won by priority, groups merged by region identity, links folded by aligned interface names, and segments, routing domains, connections and redundancy sets carried through with node references remapped. `resolve` now runs it on graphs. A model's links can keep a source's `metadata` in the observation layer.
