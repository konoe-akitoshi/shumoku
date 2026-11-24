---
'@shumoku/core': minor
---

Draw networks top to bottom by what the devices are, in one pass.

- Two linked devices as far from the top are put one above the other by device tier (internet / external / cloud, router, firewall / VPN / CPE, L3 switch / load balancer, L2 switch, access point, server). Only a pair the types do not tell apart stands side by side. Before, the hop count decided, so a router stood beside the switch under it and a host beside the switch it uses.
- The top is guessed once for each part the cables join: the most central node of the first device tier present, and of those the one with the most links. A node with both a cable and a virtual link (a hypervisor, a router with a tunnel) is no longer taken as a top, and `type: internet` is now outside the network like `external` and `cloud`. Types are read as the configuration reads them, so `switch`, `ap` or `Router` count too.
- Groups are drawn as frames of the one drawing. A group with no group in it is no longer solved on its own and set in afterwards, which bent lines at group edges and ran lines between a group and its row neighbours under the row and back up.
- Ports stand about the middle of their edge instead of at its end, and two lines crossing between two rows no longer run on each other.
