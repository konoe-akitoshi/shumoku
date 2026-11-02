---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

The new drawing's kit defines every element's look in one spec (card, port, caption, group, hull, wire) that the component only draws. Colours the kit drew with are now Theme fields (`port`, `hull`, `shadow`, `vlans`); a VLAN set takes the next colour of the palette, so distinct sets in one diagram differ. A dotted line is round caps of no length, so dots stay dots at any width. Texts are cut by width, not by character count, and a node shape is defined once (outline, safe rectangle, squaring). Core exposes `drawingArcs`, the one place a rounded corner is worked out, and drops the `drawingReport` and `drawingLabelAt` exports nothing used.
