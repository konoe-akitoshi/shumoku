Key for round 10 test 2 (written before the runs). Variants differ only in the product fields:
P1 vendor/model (+description), P2 one `product` path, P3 P1 + `software`.

Expected honest writing (all variants):
- Places: server room; AWS Tokyo region with AZs ap-northeast-1a / 1c (groups, nested). Optional
  but the AZ of each subnet is a stated fact.
- Segments: vlan10 (vlan 10, prefix 192.168.10.0/24, fw-v .2, app-1 .20); sub-a (10.0.1.0/24,
  web-c .10, tgw-1 []); sub-c (10.0.2.0/24, db-c .20, tgw-1 []).
- redundancy prod [hv-1, hv-2]; fw-v host hv-1; app-1 host prod.
- links: rt-1--hv-1 10G [vlan10], rt-1--hv-2 10G [vlan10], rt-1--tgw-1 virtual (one or two links
  for the two tunnels; either is honest).
- Products: rt-1 yamaha rtx3510; hv-1/2 dell poweredge-r750; fw-v paloalto vm-series;
  app-1 none; web-c aws ec2 (instance, t3.medium); db-c aws rds (mysql); igw-1 aws internet
  gateway; tgw-1 aws transit gateway.
- Software: hv-1/2 ESXi, app-1 Ubuntu, web-c Amazon Linux. P1/P2: description (or lost);
  P3: software.

Not expressible in the current model, expected to surface (count, do not grade as writer error):
 s1 the VPC main itself (an address range holding subnets, not a place, not an L2 segment)
 s2 a subnet's AZ (a segment has no place)
 s3 igw-1 "attached to the VPC" (no segment, no link)

Per-writer counts:
 c1 cloud product written fully and consistently (EC2 kept, size kept)   c2 software kept/structured
 c3 software squeezed into product fields      c4 invention (ports, hosts, addresses, VLANs)
 c5 how s1/s2/s3 are handled: dropped / description / group / segment / node / link
