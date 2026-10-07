1. `sub-a` belongs to `main` and is in `az-1a`.
2. `igw-1` is attached to `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of `vpn-1`.
7. Yes. The link puts `tgw-1` in `sub-c`; its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` has an address in VLAN 10, but the file does not say whether it has a cable connection.
10. Yes. The links from `rt-1` to `hv-1` and `hv-2` carry VLAN 10, so both ends are in it.

Confusing points:

- `igw-1` is assigned to `main` as a whole, but the file does not specify a link to it.
- `fw-v` has an address in VLAN 10, but no link is listed for it.
- `tgw-1` is linked to `sub-a` and `sub-c`, but has no address listed in either segment.