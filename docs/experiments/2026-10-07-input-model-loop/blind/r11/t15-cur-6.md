1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. `igw-1` is attached to `main` as a whole; the file does not say it is in any particular segment.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 (`vlan20`) belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`. Both are parts of connection `vpn-1`.
7. `tgw-1` is in `sub-c`; its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` is listed in `vlan10`, but no link involving it is listed. The file says unlisted links may still exist.
10. Cannot tell. No link puts `rt-1` in VLAN 10, but other links may exist.

**Confusing:** `sub-a` is placed in `az-1a`, though the format says a segment’s group is a place and gives availability zone only as an example. Also, `igw-1`’s `routingDomain: main` establishes domain membership, while “attached to” in the type comment could suggest a specific connection. The format does not define that distinction.