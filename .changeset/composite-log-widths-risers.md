---
'@shumoku/core': patch
---

Composite layout draws bandwidth pipes again (log widths) and separates vertical risers by actual stroke width.

The composite search engine was overwriting `ResolvedEdge.width` with the 'linear' routing experiment (10G→1px), collapsing access links to hairlines and starving the weathermap flow lanes. This patch restores the log-curve widths that `route-edges.ts` seeds and the renderers draw.

Vertical risers now use a width-aware shift search: the reach scales to the widest ribbon already placed in the corridor so two 100G ribbons (34px each, needing ≥37px separation) always find room — the fixed ±32px ceiling was 5px short.
