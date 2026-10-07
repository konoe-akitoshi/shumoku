1. `sub-a` belongs to `main` and is in `az-1a`.
2. `igw-1` belongs to `main`, but whether it is attached to the VPC is **cannot tell**.
3. `app-1` runs on one of the nodes in redundancy set `prod`; which host is **cannot tell**.
4. `web-c` is an AWS EC2 `t3.medium` and runs Amazon Linux.
5. No. VLAN 20 belongs to `guest`.
6. Two virtual links connect `rt-1` and `tgw-1`.
7. `tgw-1` is listed in `sub-c` with an unknown address (`[]`). Whether it is actually there is **cannot tell** because the address list may be partial.
8. `main` has prefix `10.0.0.0/16`.
9. **Cannot tell.** The links list is partial, and its segments only identify networks carried by those links.
10. **Cannot tell.** `rt-1` has links that list VLAN 10, but the format does not say that this is the only segment it belongs to.

Confusing points: “runs on one of the nodes in `prod`” leaves the specific host unknown. Also, `tgw-1`’s empty address list establishes known presence in `sub-c`, while the partial-list rule means it may have other addresses there.