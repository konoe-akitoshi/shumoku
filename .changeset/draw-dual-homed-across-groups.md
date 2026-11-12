---
'@shumoku/core': patch
'@shumoku/renderer': patch
'@shumoku/cli': patch
---

Draw networks that stopped the layout with "the constraints contain a cycle". A lone node in a group that holds no linked node now stands in the top row of the nearest group that does, so its group no longer reaches above a line that enters it. A line laid straight across between two boxes side by side is bent instead where the ports of a side leave its height no solution. Siblings whose rows overlap are no longer stacked one above the other. A port whose lines leave by two sides is drawn on each without stopping the renderer. A port held too near a line it cannot meet straight is moved off to the side that has room, instead of always the side it leans to.
