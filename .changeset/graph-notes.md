---
"@shumoku/core": patch
"@shumoku/renderer": patch
"@shumoku/renderer-html": patch
---

Draw what the network YAML says beyond nodes and links. `toNetworkGraph` gives nodes, segment nodes and links `annotations`: typed facts (`identity`, `relation`, `address`, `note`, `detail`, `status`, `badge`) such as the product model, AS number, host or host pool, redundancy set, routing domain, addresses no link end shows, VIPs, description, bandwidth, connection and cable. Annotations are for display and are not split back into the configuration.

A node is drawn as a card: icon and name, a subtitle with model, AS and software, then rows for relations, addresses and the description, up to four, with `+N more`. A link has a boxed caption of up to three lines (what it is, what it carries, its description) above the wires. Supplementary details (cable, prefixes of routing domains and of segments with a VLAN) and the full text of anything shortened are in the SVG title and the tooltip. Layout, interactive rendering and static SVG share one sizing.

A VM gets a VM badge and a hosted node a Hosted badge. Hosting is not a link: a graph `Node` carries `host`, no line or port is drawn, and layout places the node under its host. An assumed node has a dashed outline and an assumed link is dotted (`LinkType` gains `dotted`). A node or segment that names no group is drawn in the one group its segments or joined nodes are in.
