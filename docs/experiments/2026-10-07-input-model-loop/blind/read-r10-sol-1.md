1. `sub-a` belongs to `main` and is in `az-1a`.
2. Yes, `igw-1` is attached to `main`.
3. Either `hv-1` or `hv-2`; cannot tell which.
4. `web-c` is an AWS EC2 `t3.medium` instance running Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels are listed.
7. Yes. Cannot tell its address there; `[]` means the address is unknown.
8. `10.0.0.0/16`.
9. Cannot tell. Its host and segment membership do not establish a cable connection.
10. Yes; its links to both hypervisors carry VLAN 10.

Confusing points:

- The format permits a single address string in prose, but `addresses` is typed as `Record<string, string[]>`. The file uses single strings.
- Unlisted links are unknown, so two tunnels are recorded, but cannot tell whether more exist.