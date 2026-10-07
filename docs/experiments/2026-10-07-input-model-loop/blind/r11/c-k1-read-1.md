1. `sub-a` belongs to routing domain `main` and is in group `az-1a` (under `tokyo`).
2. Yes. `igw-1` is attached to `main`.
3. `app-1` runs on one of `hv-1` or `hv-2`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 (`vlan20`) belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of `vpn-1`.
7. `tgw-1` is in `sub-c` because it has a link to that segment. Its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. The file gives `fw-v` an address in `vlan10`, but does not list its links; unlisted links may still exist.
10. Cannot tell. No listed link puts `rt-1` in VLAN 10, but unlisted links may still exist.

Confusing points: The file lists `fw-v` and `app-1` in `vlan10` but no links for them; the format says that does not establish whether they have links. The file gives `igw-1` a routing domain but no link to it, so whether it is attached cannot be settled from the file and format.