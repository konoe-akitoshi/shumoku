1. `sub-a` belongs to `main` and is confined to `az-1a`.
2. Cannot tell. `igw-1` belongs to `main` as a whole, but no link or segment attachment is specified.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which one cannot be told.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two virtual links connect `rt-1` and `tgw-1`.
7. Cannot tell whether `tgw-1` is in `sub-c`. Its address there is unknown; `tgw-1: []` says it is known to be in the segment, but its address is not known.
8. `main` has prefix `10.0.0.0/16`.
9. Cannot tell. `fw-v` has an address in VLAN 10, but no link to it is listed; unspecified links may exist.
10. Cannot tell. No link lists `rt-1` as carrying VLAN 10, but an unlisted link may carry it.

**Confusing or potentially ambiguous**

- `sub-c` lists `tgw-1: []`, which says it is in the segment, while no link lists `sub-c` among its segments. The format allows a node to be in a segment without a known link into it.
- `igw-1` has `network: main`, which means it belongs to the routed network as a whole; it does not establish attachment to any particular subnet or segment.
- The format distinguishes what is explicitly listed from what may exist but is unknown, so missing links or segment memberships do not establish absence.