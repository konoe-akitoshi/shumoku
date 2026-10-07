1. `sub-a` belongs to `main` and is in `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one, **cannot tell**.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. `tgw-1` is in `sub-c` because a link joins it to that segment. Its address there: **cannot tell**.
8. `main` has prefix `10.0.0.0/16`.
9. **Cannot tell.** No cable connection for `fw-v` is listed, but the format says unlisted links may still exist.
10. Yes. A link between `rt-1` and `hv-1` carries VLAN 10, so both ends are in that segment.

Confusing or potentially unclear:

- The file names `az-1a` and `az-1c` as groups, but does not explicitly label them as availability zones.
- The format says a node is in a segment when a link carries that segment, ends at the segment, or the node has an address there. The `tgw-1` link to `sub-c` establishes its membership, but not an address.
- The format does not define “VPC”; `main` is a routing domain, and the file’s prefix and AWS nodes do not explicitly identify it as a VPC.