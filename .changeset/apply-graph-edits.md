---
"@shumoku/core": patch
---

Add `applyGraphEdits(model, drawn, edited)`, which writes the edits made to a graph drawn with `toNetworkGraph` back into the model: only what changed between the two graphs is written, so the configuration keeps what the graph cannot say (a node's software or host, routing domains, a link's description) and a field drawn from another, such as a product name or a link speed, stays as written until it is edited.
