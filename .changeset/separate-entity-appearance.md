---
'@shumoku/core': major
---

Separate node shape and node/link/subgraph styles from stored topology in NetworkDocument schema v2. Presentation now contains nodes, links and subgraphs collections; replace geometry-only node helpers with separateNodePresentation and combineNodePresentation. Reject invalid, duplicate or stale display overrides and require stable IDs for styled links.
