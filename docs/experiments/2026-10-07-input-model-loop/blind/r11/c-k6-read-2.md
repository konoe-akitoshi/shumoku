1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. `tgw-1` is in `sub-c` because a link joins it to that segment. Its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. No link to `fw-v` is listed, but the format says omitted links may still exist.
10. Yes. The `rt-1` links list `vlan10`.

Confusing points: The format calls `group` a place, while the question calls `az-1a` an availability zone; the file does not explicitly label its groups as zones. Also, although `sub-a` lists an address for `web-c`, no link connects `web-c` to that segment; the format allows a node to be in a segment without a known link.