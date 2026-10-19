---
"@shumoku/core": minor
---

Remove the older YAML parser (`YamlParser`, `HierarchicalParser`, the file resolvers, `dumpGraph` and the `./parser` subpaths) and the multi-file `sampleNetwork` fixture. Read YAML with `readNetworkModel` and draw it with `toNetworkGraph`; the sample is `sampleNetworkModel()`. Every field of the input model now carries a description, and the YAML reference is generated from those types.
