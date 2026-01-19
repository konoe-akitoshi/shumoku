---
"@shumoku/parser-yaml": patch
---

fix(parser-yaml): merge export connectors to same destination subgraph

Export connector nodes that point to the same destination subgraph are now
merged into a single node. This reduces visual clutter when multiple devices
connect to the same external subgraph.

Before: Each device connection created a separate export connector node
After: All connections to the same destination share one export connector node
