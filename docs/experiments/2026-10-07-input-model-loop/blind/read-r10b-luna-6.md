1. `sub-a` belongs to `main` and is in `az-1a`.
2. Cannot tell. `igw-1` belongs to `main`, but no attachment is specified.
3. `app-1` runs on `prod`, meaning one of its nodes, but which one cannot be told.
4. `web-c` is an AWS EC2 `t3.medium`; it runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two virtual links connect `rt-1` and `tgw-1`.
7. Cannot tell. `tgw-1` has an empty address list in `sub-c`, so its address there is unknown; its presence in the segment is stated.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. The file lists `fw-v` in `vlan10` and links `rt-1` to the hypervisors on that segment, but does not specify whether `fw-v` has a cable connection.
10. Cannot tell. `fw-v` is listed in VLAN 10, but the links do not identify it as an endpoint.

Confusing points: `tgw-1` is explicitly listed in `sub-c` with an empty address list, so it is known to be in that segment, though its address is unknown. Also, the format says links carrying a segment put both ends in it, but no listed link names `vlan10` with `fw-v` as an endpoint.