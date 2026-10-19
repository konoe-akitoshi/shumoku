---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

Draw what the network YAML says beyond nodes and links. `toNetworkGraph` now gives nodes, segment nodes and links `notes`: a node's product model, AS number, addresses no link end shows, the redundancy set it is in when no link joins the members, the host set it runs on, the routing domains it reaches, members, description and an `(assumed)` mark; a segment's VLAN, prefixes and routing domain; a link's description, segments without a VLAN, bandwidth, connection and cable. The renderers write notes under a node's label and by a link, layout sizes nodes and places link text for them, and notes are not split back into the configuration.

An assumed link is now drawn dotted and a VM's line to its host with sparse dots, so neither looks like a virtual (dashed) link; `LinkType` gains `dotted` and `runs-on`. A node or segment that names no group is drawn in the one group its segments or joined nodes are in. The flat layout places link text clear of nodes and other text, link text has a halo so lines and port labels do not cover it, and the SVG font stacks name common fonts before the generic family, which some systems resolve to a condensed face.
