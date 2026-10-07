1. **sub-a** belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is linked to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod` (`hv-1` or `hv-2`); which one, **cannot tell**.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. `tgw-1` is connected to segment `sub-c`, so it is in that segment. Its address there: **cannot tell**.
8. `main` has prefix `10.0.0.0/16`.
9. **Cannot tell.** The file does not say whether `fw-v` has a cable connection.
10. Yes. `rt-1` is an endpoint of links that carry VLAN 10 (`vlan10`).

Confusing points: `az-1a` is not explicitly identified as an availability zone; it is a group, and the format describes groups as places. Also, the format says links to a segment make a node part of it, but does not distinguish whether that attachment is cabled.