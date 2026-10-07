1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. `igw-1` is attached to routing domain `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot tell.
4. `web-c` is an AWS EC2 `t3.medium` running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of connection `vpn-1`.
7. Yes. The link to `sub-c` puts `tgw-1` in it; its address there cannot tell.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` has no listed link, and links without `fw-v` do not rule out other connections.
10. Yes. Both links that carry VLAN 10 put their endpoints, including `rt-1`, in it.

Confusing points: `igw-1`’s `routingDomain: main` says it is attached to `main` as a whole, but does not say how it connects. A link to a segment establishes membership, but the segment’s address list may be partial, so `tgw-1`’s address in `sub-c` is unknown. The `prod` host reference means one of its nodes, but does not identify which.