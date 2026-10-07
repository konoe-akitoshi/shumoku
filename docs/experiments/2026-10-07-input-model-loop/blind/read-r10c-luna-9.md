1. `sub-a` belongs to `main` and is in `az-1a`.
2. Cannot tell. `igw-1` belongs to `main`, but the file does not say it is attached to it.
3. `app-1` runs on `prod`; which host in that redundancy set is unknown.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two virtual links connect them.
7. Yes. `tgw-1` is listed in `sub-c`; its address there is unknown.
8. `10.0.0.0/16`.
9. Cannot tell. The file lists `fw-v` in VLAN 10, but does not specify whether its connection is a cable.
10. Yes. `fw-v` is listed in VLAN 10, and the link carrying that segment places both endpoints in it.

Confusing or underspecified:

- The format says links without `segments` may carry segments, and nodes without listed links may still be connected. This makes absence of a link or segment listing inconclusive.
- `igw-1` having `network: main` establishes network membership, but the format does not define whether that means it is attached to the VPC.
- `tgw-1` has empty address lists in both subnets, meaning it is present there but its addresses are unknown.