---
'@shumoku/core': minor
---

The old tiered layout engine is removed: `computeNetworkLayout`, `createNetworkLayoutEngine`, `createEngine`, `routeEdges`, `placePorts`, `moveNode`, `rebalanceSubgraphs`, `collectObstacles`/`resolvePosition`, `buildHierarchicalSheets`, `ResolvedLayout`/`ResolvedPort`/`ResolvedEdge`, `LayoutResult`, the `@shumoku/core/layout` subpath, the node-size constants and the presentation helpers only the old renderers used (`nodePresentation`, `linkPresentationLines`, `DIAGRAM_CARD`, ...). Draw with `drawNetwork` (or `drawNetworkScene` from `@shumoku/renderer`).
