1. **main**, in **az-1a**.
2. **Yes.** igw-1 is attached to routing domain main.
3. **prod**; that means it runs on one of the set’s nodes, but which one cannot be told.
4. An **AWS EC2 t3.medium**; it runs **Amazon Linux**.
5. **No.** VLAN 20 belongs to **guest**.
6. **Two tunnels**, and both are parts of **vpn-1**.
7. **Cannot tell.** The link puts tgw-1 in sub-c, but no address is listed for it there.
8. **10.0.0.0/16**.
9. **Cannot tell.** fw-v has no listed links, and an unlisted link may still exist.
10. **Yes.** Its links list VLAN 10.

**Potentially confusing:** The file calls `main` a routing domain but does not label it as a VPC; the format says a routing domain can represent a VPC. Also, the address list for sub-c names only db-c, so it does not establish that tgw-1 has no address there.