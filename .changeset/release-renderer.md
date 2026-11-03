---
'@shumoku/renderer': minor
---

**The renderer draws the new engine's `Scene`.** It no longer lays anything out.

- `drawNetworkScene(model, options)` draws a model with the kit's metrics. `drawingMetrics` and `createKit` are the metrics and text measurement behind it, and `Diagram` is the Svelte component that renders a scene.
- `ShumokuRenderer` takes a `scene`. It reports a node or group drop through `ondrop`, so the Editor can store the drop as an order hint, never as a coordinate.
- `@shumoku/renderer/static` is a plain-JS build, so Node and Bun can render without a Svelte plugin. It exports `renderNetworkSvg`, `renderSceneSvg` and `drawNetworkScene`.
- Every element's look is defined once in the kit (card, port, caption, group, hull, wire). Colours are `Theme` fields (`port`, `hull`, `shadow`, `vlans`), and distinct VLAN sets in one diagram take distinct colours.
- **Removed:** layout serialisation (`serializeLayout`, `deserializeLayout`, `layoutToJson`, `jsonToLayout`, `SerializedLayout`), the bezier helpers (`bezierEdgePath`, `bezierOffsetPath`), `renderSvgString`, `polylinePath`, `computePortLabelPosition`, `getNodeLabel`, `getVlanStroke`, `themeToColors` and `RenderColors`. `renderGraphToSvg` moved to `@shumoku/renderer-svg`.
- **Fixed:** the package names `@shumoku/core` by version range. 0.1.5 declared `workspace:*` and could not be installed from npm.
