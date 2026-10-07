1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. `tgw-1` is connected to segment `sub-c`, so it is in that segment. Its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` has no listed links, and the format says unlisted links may still exist.
10. Yes. A link between `rt-1` and `hv-1` carries VLAN 10, which places both ends in that segment.

**Confusing points:** The format says a link with no `segments` may still carry some, so the listed links do not fully establish segment membership. Also, “availability zone” is not a specific field in the format; `az-1a` is represented as a group.