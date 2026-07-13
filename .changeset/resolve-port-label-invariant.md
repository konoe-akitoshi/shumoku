---
"@shumoku/core": patch
---

fix(resolve): guarantee a folded port always has a string `label`

A link that referenced a bare interface name on a node that never enumerated
the port produced a resolved `NodePort` with `label: undefined`, crashing layout
and SVG rendering (`port.label.trim()`). `foldPortCluster` now falls back to the
port's interface name (or empty string) so the `NodePort.label: string` contract
always holds. Surfaced by the Arista CV-CUE topology (AP↔switch links) merged
onto a NetBox topology.
