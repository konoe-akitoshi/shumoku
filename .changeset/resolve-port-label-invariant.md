---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

fix(layout): a port with no label no longer crashes layout/render

A link that referenced a bare interface name on a node that never enumerated
the port yielded a `ResolvedPort`/`NodePort` with `label: undefined`, crashing
the layout and SVG renderer (`port.label.trim()` in the flat-tree engine,
composite router, port-geometry, and SvgPort). The flat-tree `PortInfo` now
defaults a missing label to `''`, the resolver's `foldPortCluster` falls back
to the interface name, and the `.trim()` sites are null-safe. Surfaced by
merging the Arista CV-CUE topology (AP↔switch links) onto a NetBox topology.
