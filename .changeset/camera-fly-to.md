---
'@shumoku/renderer': patch
---

Camera: `flyTo(nodeIds | 'fit')` flies smoothly to a set of nodes or back to the fit (van Wijk–Nuij path, eased; any input stops it; a jump under reduced motion), and `onUserMove(listener)` tells a host when a person, not its own calls, moved the view.
