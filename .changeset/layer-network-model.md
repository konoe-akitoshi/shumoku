---
"@shumoku/core": patch
---

Split `Node`, `Link`, `Subgraph` and `NetworkGraph` into layers by who writes them: config (the network as the input YAML writes it, shared by Server and Editor), observation (Server's merge of sources), design (Editor's physical design) and drawing. The config layer gains what the new input writes: a node's product, software, address, AS, host and members; a link's bandwidth, segments and connection; whether either is assumed or a link is virtual; and segments, routing domains, connections, redundancy sets and links to a segment at the top.
