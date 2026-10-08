1. `sub-a` belongs to routing domain `main` and is in availability zone `az-1a`.
2. Yes. `igw-1` is attached to `main`.
3. `app-1` runs on one of the nodes in redundancy set `prod` (`hv-1` or `hv-2`); which one, **cannot tell**.
4. `web-c` is an `aws/ec2/t3.medium` node and runs `amazon-linux`.
5. No. VLAN 20 belongs to `guest`.
6. Two tunnels connect `rt-1` and `tgw-1`; both are parts of `vpn-1`.
7. `tgw-1` is connected to segment `sub-c`, so it is in that segment. Its address there is **cannot tell**.
8. `main` has address range `10.0.0.0/16`.
9. **Cannot tell.** No cable is specified, but the file does not establish that `fw-v` has no cable.
10. **Cannot tell.** The file lists `vlan10` on links between `rt-1` and the hypervisors, but does not say whether `rt-1` itself has an address or other presence in the segment.

Confusing or underspecified:

- The format says a node is in a segment when a link carrying that segment ends at it. That makes `rt-1` in `vlan10` under the stated rule, though no address is listed for it.
- `tgw-1` is connected to `sub-c`, but no address for it is given.
- `fw-v` has an address in `vlan10`, but no link to it is listed; its connectivity is unknown.