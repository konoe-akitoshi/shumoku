---
"@shumoku/core": minor
"shumoku-plugin-netbox": patch
---

Line styles the drawing cannot draw are removed: `ArrowType` and `LinkDrawing.arrow`, `EdgeStyle` / `SplineMode` and the `edgeStyle` / `splineMode` graph settings, and the `'solid'` / `'double'` link types (`LinkType` is `'dashed' | 'dotted'`; a link with no type is solid). `parseWithMaps` / `stringifyWithMaps` (`map-json`) and the HA hull path helper moved out of core; the hull is drawn by the renderer's kit. The NetBox plugin no longer writes `arrow`.
