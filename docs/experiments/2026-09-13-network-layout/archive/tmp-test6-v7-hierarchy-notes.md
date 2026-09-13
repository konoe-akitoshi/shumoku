# V7 polar exterior / hierarchical Cartesian interior

Run `bun run tmp-test6-v7-hierarchy.mjs`, then
`bun run tmp-test6-export-placement.mjs --v7-hierarchy`.

The previous `tmp-test6-v7-polar-report.json` is the frozen exterior input. All
31 group positions and dimensions, all 196 boundary terminals, and every exterior
polyline of the 98 cross-group links are retained exactly. Node sizes and labels
are unchanged. The fixture hash is verified before generation.

## Hierarchy interpretation

Within each group, all externally attached nodes are candidate entry roots. This
does NOT infer actual network traffic direction. The explicit Internet node is
the sole root in its own group. Multi-source undirected BFS supplies display depth
and a spanning forest. An unconnected component without an external attachment
would get a highest-internal-degree display root with deterministic tie-breaking;
these fallback roots are recorded rather than treated as known physical roots.

Depth bands run top-to-bottom. Nodes in one depth band are ordered horizontally.
Because existing frame sizes are frozen, siblings wrap into balanced rows when
one row cannot fit. Thus y alone is NOT the depth index: four APs in two rows
remain four direct children, not two levels of APs. Actual depth and parent IDs
are recorded per node. Full node geometry and text size are preserved.

Enumerate sibling/root ordering within each level to reduce internal and boundary
attachment distances while respecting the bands. This is not a global optimum.
Every internal link is retained: 37 link records belong to the displayed tree
relations, and 25 are same-level or alternate connections. Several roots or cycles
can therefore produce a forest/mesh rather than a single tree. Tree connections
are solid blue; non-tree internal connections are dashed gray.

Internal paths are orthogonal polylines routed around other node rectangles;
external boundary-to-boundary paths are unchanged. Shared segments and line-line
crossings remain possible. Boundary terminals represent logical drawing points,
not additional devices or fabricated physical ports.

## Checks

89 node and 160 link records preserved, no actual node overlap or containment
violation, every selected parent above its child, no non-orthogonal internal
segment, no internal path piercing an unrelated node, exact frozen exterior
geometry. The report includes depth bands, folded rows and all connection paths.

The detail image shows Exhibition Hall East: one PoE root and four same-depth APs
folded into two rows. The full and placement-only images retain all groups.
