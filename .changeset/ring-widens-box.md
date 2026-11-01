---
"@shumoku/core": patch
---

When the rooms asked of a layout add up to more than a box is wide (a ring of reaches round it), the box the ring runs against is grown by what the ring lacks, rather than one of the rooms being given up. A room is given up only when no box can grow, and then from the ring's boxes. The drawing no longer lets a line pass through a card in that case.
