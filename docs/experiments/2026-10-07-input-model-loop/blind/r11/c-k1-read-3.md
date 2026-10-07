1. `sub-a` belongs to `main` and is in `az-1a`.
2. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are part of connection `vpn-1`.
7. `tgw-1` is linked to `sub-c`, but whether it is in that segment cannot tell. Its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. The file lists an address for `fw-v` in VLAN 10 but no link naming `fw-v`.
10. Yes. A listed link carries VLAN 10 and has `rt-1` as an endpoint.

Confusing points: The format says a link to a segment puts the node in that segment, while `segments` lists what a link carries. The file uses a link to `sub-c`, so it seems to place `tgw-1` there, but it does not list that segment under a `segments` field. Also, `addresses` lists `fw-v` in VLAN 10 without a link to it; the format allows a node to be in a segment without a known link, but the file does not say how `fw-v` connects.