---
'@shumoku/core': patch
---

**layout**: choose the diagram apex from structure first, role hints second.
Device-type tiers say what a box *is*, not where it *sits* — when the only
role-tagged router in an inventory is a degree-1 management stub while the real
WAN edge is a `generic` switch terminating the fattest trunk, trusting the role
rooted the whole map at the stub and drew the network upside down.

- A boundary-role device (≤ Router tier) seeds the rank root only when the
  structure corroborates it: degree ≥ 2, or it sits on a fat trunk, or the
  graph carries no bandwidth data at all (no evidence against it).
- With no trustworthy boundary role, the root falls back to the physics: the
  most peripheral endpoint (lowest degree) of the fattest trunks.
- Leaf classes (AP/CPE and deeper) never seed the root — a network whose
  lowest resolvable tier is its access points has no hierarchy information,
  and rooting at the leaves is exactly the inversion bug. Falls through to
  highest-degree instead.
