1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`. Both are parts of connection `vpn-1`.
7. `tgw-1` is connected to segment `sub-c`, so it is in that segment. Its address there: cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. The file gives no link for `fw-v`, but an unwritten link may still exist; no cable is specified.
10. Yes. The link between `rt-1` and `hv-1` carries VLAN 10, so both ends are in that segment.

Confusing or potentially ambiguous:

- The format describes `group` as a place and says `sub-a` is in `az-1a`; the file does not explicitly call `az-1a` an availability zone.
- “VPC” is an example of a routing domain, but the file labels `main` only as a routing domain.
- The format says a segment address list may be partial, so `sub-c`’s listed address does not settle `tgw-1`’s address.