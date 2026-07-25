---
'@shumoku/core': patch
'@shumoku/renderer': patch
'@shumoku/renderer-svg': patch
---

Redundancy groups (HA / vPC / MLAG / stack) render as a "glasses hull": one
solid silhouette behind the member nodes — a rounded lens per member joined by
a notched bridge at the seam — replacing the old parallel double-line
("glasses") link rendering.

- The redundancy link itself now draws as a NORMAL link: ports, port labels
  and hit-testing survive, and the link is metrics-mappable like any other
  wire, so the weathermap overlay (utilization color / flow particles / idle)
  applies with no special-casing.
- Coupling seam ports render as elongated stack-port bars with the label
  inside (rotated on lateral faces).
- New core geometry util `buildHaHullPath` / `groupCouplingPairs` shared by
  the interactive renderer and the static SVG renderer, which now draws the
  hull too (it previously rendered redundancy links as plain lines).
- Layout: coupling ports seat inward on the facing sides; the redundancy-pair
  gap widens (16 → 48) so the seam link and hull notch have room.
- New `haHullFill` render-color token (theme-invariant `#3c3c3c`).

Only links with an explicit `redundancy:` field get this treatment — no
automatic pair inference.
