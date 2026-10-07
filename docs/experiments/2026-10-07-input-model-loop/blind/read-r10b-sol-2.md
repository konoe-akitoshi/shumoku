1. `sub-a` belongs to `main` and is in `az-1a`.
2. Yes. `igw-1` belongs to `main` as a whole.
3. Either `hv-1` or `hv-2`; cannot tell which.
4. An AWS EC2 `t3.medium` instance running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels.
7. Yes; cannot tell its address there.
8. `10.0.0.0/16`.
9. Cannot tell.
10. Yes; both links to the hypervisors carry VLAN 10.

Confusing: “attached” is not a defined relationship; `igw-1.network: main` establishes membership, but gives no specific connection. The format otherwise made these answers clear.