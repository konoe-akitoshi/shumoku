---
'@shumoku/core': patch
---

**Drawing fixes found by drawing a NetBox.** `external` and `cloud` nodes are the top whenever the input has any, ahead of the nodes where a cable meets a virtual link (a NetBox with tunnels, VM adapters and L2VPNs had its transits drawn at the bottom). A VM on a host that no line reaches, such as a VM in a cloud, is drawn beside its host instead of being left out (and a line to it no longer fails with "no way through the corridors"). Two lines laid straight across between the same two boxes, with ports named in opposite orders on the two sides, no longer fail with "the constraints contain a cycle".
