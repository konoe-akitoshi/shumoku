---
"@shumoku/renderer": minor
---

`ShumokuRenderer` draws a scene (`scene` prop, from `drawNetworkScene` or `drawNetwork`) with the kit instead of the old resolved layout. Selection, context menu, marquee, camera and the overlay snippets stay; the overlay contexts now carry the wire's polyline and corner radii (`polylineOffsetPath(points, radii, offset)` draws a lane beside it). Position dragging, port moves, link creation by drag, `addNewNode`/`addNewSubgraph`, sheets and the layout/graph/maps props are removed; the web component takes `scene` instead of `layout`/`graph`.
