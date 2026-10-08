1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which host cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. `tgw-1` is connected to segment `sub-c`, so it is in that segment. Its address there: cannot tell.
8. `main` has range `10.0.0.0/16`.
9. Cannot tell. `fw-v` has an address in VLAN 10, but no cable connection is specified.
10. Yes. The `rt-1`–`hv-1` and `rt-1`–`hv-2` links both carry VLAN 10, so `rt-1` is in it.

Confusing or potentially ambiguous:

- `server-room` is a group, but its relationship to `tokyo` is unspecified; the file does not say whether it is in Tokyo.
- `tgw-1` has virtual links to `sub-a` and `sub-c`, but no addresses are listed for it in either segment.
- `fw-v` has an address in VLAN 10 without a listed link into that segment. The format allows a node to be in a segment without a known link.