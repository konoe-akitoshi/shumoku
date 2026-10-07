1. `sub-a` belongs to `main` and is in `az-1a`.
2. `cannot tell` — `igw-1` belongs to `main`, but no link or segment attachment is specified.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot be told.
4. `web-c` is an AWS EC2 `t3.medium`; it runs Amazon Linux.
5. No. VLAN 20’s segment belongs to `guest`.
6. Two virtual links (tunnels).
7. `cannot tell` whether `tgw-1` is in `sub-c`. Its address there is unknown; the empty list means its address is unknown if it is in that segment.
8. `10.0.0.0/16`.
9. `cannot tell` — its link to `hv-1` lists VLAN 10, but the format does not say whether that connection is a cable.
10. `cannot tell` — VLAN 10 lists `fw-v` as present, but does not say whether `rt-1` is present.

**Confusing points:** The format says a listed link segment puts both endpoints in the segment, but the VLAN 10 addresses omit `rt-1`. It also says a node may be in a segment without a known link, so segment membership alone does not establish a connection.