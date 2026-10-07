1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of `prod`’s nodes; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 (`vlan20`) belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. Cannot tell whether `tgw-1` is in `sub-c`. The link connects it to that segment, but the format says that only establishes membership for a node attached to the segment. No address for `tgw-1` is listed there.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` is listed in `vlan10`, but no link involving it is listed; links may be omitted.
10. Yes. The link from `rt-1` to `hv-1` carries `vlan10`, which puts both ends in that segment.

**Confusing or underspecified**

- The format says a link carrying a segment puts both ends in it, but does not clearly say whether a link *to* a segment also puts the node end in it. The `tgw-1`/`sub-c` case depends on this.
- `fw-v` is listed in `vlan10`’s addresses, but no link involving it is given. The format allows incomplete link information, so its connectivity cannot be inferred.