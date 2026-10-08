1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to `main`.
3. `app-1` runs on one of `hv-1` or `hv-2`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of `vpn-1`.
7. `tgw-1` is connected to `sub-c`, but whether it is in the segment cannot tell. Its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. The file shows links involving `fw-v`’s segment, but does not say whether those links use cables.
10. Cannot tell. `rt-1` has no listed link carrying VLAN 10, but the format says unlisted links may still exist.

Confusing points:

- The format says a link without `segments` may still carry segments, so omitted segment membership does not settle whether a node is in a segment.
- Segment membership can follow from a link ending at the segment itself, but the format does not state whether that membership gives the node an address.
- The `group` description calls `az-1a` an availability zone, while the type describes groups more generally as places.
- `main` is called a VPC in the question, but the file does not label its routing-domain type.