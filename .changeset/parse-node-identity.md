---
'@shumoku/core': minor
---

Make hand-authored graphs survive a YAML round trip.

`YamlParser` read every `Node` field except `identity`, so a Manual data source's nodes were silently stripped of the keys `resolve()` clusters on and the metrics-mapping stack needs to bind a node to a monitoring host — leaving hand-drawn devices permanently unmappable. `NodePort.identity` was already parsed; this closes the same gap one level up.

Adds `dumpGraph()`, the inverse of the parser, so a graph can be written back to authoring YAML without loss: it quotes values that need it (a label containing a newline made the previous hand-rolled writer emit an unparseable document) and spreads the graph rather than enumerating keys, converting only the three shapes the parser stores differently from how it reads them — `spec` on nodes and subgraphs, and `plug` on link endpoints. `parse(dumpGraph(g))` is a fixed point.
