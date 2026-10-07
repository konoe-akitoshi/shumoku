1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one, **cannot tell**.
4. `web-c` is an AWS EC2 t3.medium running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. `tgw-1` is in `sub-c` because a link joins it to that segment. Its address there: **cannot tell**.
8. `main` has prefix `10.0.0.0/16`.
9. **Cannot tell.** `fw-v` has an address in VLAN 10, but no link listing it as an endpoint. The format says unlisted connections may still exist.
10. Yes. `rt-1` is in VLAN 10 because links carrying VLAN 10 end at it.

Confusing points: `sub-a` and `sub-c` have prefixes within `main`’s prefix, but only their explicit `routingDomain` fields establish membership. The file lists `fw-v` and `app-1` in VLAN 10, but only `app-1` is on a link carrying that VLAN; the format allows segment membership without a known link.