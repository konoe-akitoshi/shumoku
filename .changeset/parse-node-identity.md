---
'@shumoku/core': patch
---

Parse node-level `identity` (mgmtIp / chassisId / sysName / vendorIds) in hand-authored YAML graphs. `YamlParser` previously read every `Node` field except `identity`, so a Manual data source's nodes were silently stripped of the identity keys that `resolve()` clusters on and that the metrics-mapping stack needs to bind a node to a monitoring host — leaving hand-drawn devices permanently unmappable. `NodePort.identity` was already parsed; this closes the same gap one level up.
