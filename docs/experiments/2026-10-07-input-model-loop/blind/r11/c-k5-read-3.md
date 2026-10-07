1. `sub-a` belongs to `main` and is in `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of `prod`’s nodes; which one, **cannot tell**.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of `vpn-1`.
7. **Cannot tell** whether `tgw-1` is in `sub-c`: the link joins it to the segment, but the format doesn’t say whether that endpoint puts the node in the segment. Its address there is **cannot tell**.
8. `main` has prefix `10.0.0.0/16`.
9. **Cannot tell.** `fw-v` has an address in VLAN 10, but the file does not say whether it has a cable connection.
10. Yes. The link between `rt-1` and `hv-1` carries VLAN 10, so both ends are in it.

**Confusing or underspecified**

- The format says a node is in a segment when a link carrying that segment ends at it, or when a link joins it to the segment itself. The `tgw-1`–`sub-c` link has a segment endpoint but does not list `segments: [sub-c]`; the relationship is therefore unclear.
- The note says a link without `segments` may still carry some, and that nodes without listed links may still be connected somewhere. So the file cannot settle whether `fw-v` has a cable connection.