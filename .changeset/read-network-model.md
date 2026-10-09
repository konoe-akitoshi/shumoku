---
"@shumoku/core": minor
"@shumoku/cli": minor
"@shumoku/renderer": patch
---

Read and write the new network YAML. `readNetworkModel` reads it into a `NetworkModel`, `toNetworkGraph` builds the graph that layout and the renderers draw from a model, and `fromNetworkGraph` / `writeNetworkModel` split a graph back into its configuration and layers and write the configuration as YAML. `sampleNetworkModel()` is the sample network in the new form. The CLI now reads the new YAML; older YAML must be rewritten.
