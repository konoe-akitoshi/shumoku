---
'@shumoku/core': patch
---

Parser: read `identity`, `membership` and `scope` on subgraphs.

`dumpGraph` wrote them but `YamlParser` never read them, so a graph exported to YAML and pasted back lost the key `resolve()` clusters regions by. A region that should merge with the same region a discovery source reports became two same-labelled boxes with the members split between them — from a document that looked correct, with no warning.
