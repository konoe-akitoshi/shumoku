---
"@shumoku/core": patch
---

Add `NetworkModel`: the configuration as the YAML writes it (`inputModel.Network`), with the observation, design and drawing layers that ride on it, each keyed by the configuration's ids. The fields of `Node`, `Link`, `Subgraph` and `NetworkGraph` are now grouped into those layers (`NodeObservation`, `NodeDesign`, `NodeDrawing`, ...); the graphs themselves are unchanged. A link in the input may now have an `id`, for layers to refer to it.
