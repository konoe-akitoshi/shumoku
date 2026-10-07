1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Cannot tell. `igw-1` is attached to `main`, but the file does not establish that `main` is a VPC.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot be told.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. Yes. `tgw-1` lists `sub-c` in its segments, so it is in that segment. Its address there cannot be told.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` has no listed links, but the format says that does not establish it is unconnected.
10. Yes. The `rt-1`–`hv-1` and `rt-1`–`hv-2` links both carry VLAN 10, placing both endpoints in it.

**Confusing points:** The file gives `main` a prefix but does not say it is a VPC. The `main` prefix overlaps the listed `sub-a` and `sub-c` prefixes, which may be intentional.