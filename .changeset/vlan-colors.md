---
'@shumoku/core': patch
'@shumoku/renderer': patch
---

A line's colour now names one VLAN. A line carrying a single VLAN is drawn in that VLAN's colour, taken in VLAN-id order, so the links of one VLAN can be followed by it. A trunk, which carries several VLANs, is drawn in the plain line colour, and its caption lists what it carries. Before, every distinct set of VLANs got a colour of its own, so a trunk's colour named nothing and a VLAN's links did not share one. The VLAN palettes of the light and dark themes are softer, and the dark theme has its own, lighter set.
