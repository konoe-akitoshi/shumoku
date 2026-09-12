# Corrected V7: content-sized hierarchy, polar exterior

Run `bun run tmp-test6-v7-boundary.mjs --tree`, then
`bun run tmp-test6-export-placement.mjs --v7-tree`.

This supersedes the folded-interior experiment. Its fixed-size packing and row
partitioning are NOT used. Historical outputs are retained separately.

## Actual model

1. Derive an internal display hierarchy from boundary-connected nodes by multi-
   source BFS; the explicit Internet node is the root of its own group. Retain
   all links, including links outside the selected spanning forest. This is not
   a claim about physical traffic direction and does not depend on device roles.
2. Each depth is exactly one horizontal row. Compute required width from the sum
   of its node widths and inter-node gaps. Compute height from the depth rows.
   The frame encloses these rows plus drawing padding and title extent. There is
   no maximum frame width/height, folding, clipping, or glyph scaling.
3. Place these content-sized groups using the existing polar macro search.
4. Plot exit/entry terminals on their boundaries, then choose horizontal node
   ordering within each depth. Permuting a row does not change its required size.
   Do not project arbitrary interior coordinates into an externally imposed box.
5. Render all original links through the boundary points, with the existing
   exterior-frame avoidance. Internal connections are straight in this variant;
   interior line crossings/node occlusion are not optimized.

Drawing metrics retained from previous node geometry: 18px horizontal node gap,
20px depth gap, 24px horizontal/bottom inset, 44px top inset for the group title.
These measure the enclosure; they are not fixed frame dimensions or size caps.

## Checks

89 nodes, 160 links, 31 groups, 196 boundary terminals preserved. Original input
hash, node IDs/link IDs and glyph sizes checked. Same-depth y equality, parent-
above-child ordering, actual node/group non-overlap, containment, terminal-on-
boundary geometry and absence of exterior-frame penetration all pass.

Exhibition Hall East is now 630x184px, derived from one parent and four children
in one row. A synthetic 12-child sizing check produces a 1830px-wide frame and
keeps all 12 children in the same row, demonstrating that no width cap/folding
is active. Horizontal ordering enumeration is research-scale (small groups),
not a production scalability claim. No global-optimality claim is made.
