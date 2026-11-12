---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

Balance the drawing: a box with room to spare now stands in the middle of it instead of at the left edge, and every box is drawn weakly towards the middle of the boxes it hands over to (and is handed over by).

A switch with many terminals no longer draws them in one very wide row: a fan of more than six boxes folds into rows of at most five, the later rows one rank lower and standing under the first as one block.

A group with no group inside it is now drawn compactly on its own and set into its parent as one box, so a wide group no longer spreads across the whole drawing.
