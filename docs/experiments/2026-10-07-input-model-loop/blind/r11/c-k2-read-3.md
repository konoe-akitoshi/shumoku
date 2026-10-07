1. `sub-a` belongs to `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. Cannot tell. `tgw-1` has a virtual link to `sub-c`, but that link puts its endpoint in the segment only if the endpoint is a node attached to the segment? The format says a link to a segment puts the node in it, so `tgw-1` is in `sub-c`. Its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` has no links listed, and the format says unlisted links may exist.
10. Yes. `rt-1` is an endpoint of a link carrying `vlan10`, so it is in that segment.

Confusing points:

- The format says a node endpoint linked to a segment is in that segment, while the file’s link is marked `virtual`; it is unclear whether “virtual” changes that membership rule.
- “Availability zone” is inferred from group `az-1a`; the format defines groups as places but does not define availability zones.