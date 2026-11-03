---
'@shumoku/core': patch
---

A part of the network that names no boundary is no longer drawn as one row. `boundaryOf` now guesses the upstream of each connected part that none of the named signals reaches: by node type (router and firewall, then L3 switch, L2 switch, access point), then by the fastest link, and failing those the most central node. The golden drawing test goes through `drawNetwork`, so the boundary each written network gets is pinned too.
