Key for round 10 test 3 (written before the runs). Same task (task-r10-2.md). Both variants have
`product` (path), `software`, `Segment.group` and the parallel-links note. They differ in the VPC:
T-A the VPC is a node in each of its subnets (its implicit router); T-B a top-level routed
network list that segments point to.

Expected:
- products as in key-r10-2 written as paths; software: hv ESXi, app-1 Ubuntu, web-c Amazon Linux
  (db-c MySQL in software or product: either is honest).
- sub-a group az-1a, sub-c group az-1c (AZ groups under the Tokyo region).
- two virtual links rt-1--tgw-1.
- T-A: node main (VPC) with sub-a: [] and sub-c: []; igw-1 virtual link to main; tgw-1 in sub-a
  and sub-c ([]). VPC range 10.0.0.0/16: no field -> description or lost (count it).
- T-B: networks [{ id: main, prefix: 10.0.0.0/16 }], sub-a/sub-c network: main; igw-1 attached to
  the VPC: no way except a link to something -> expect loss or an invented node (count it).

Counts: v1 VPC written once, in the intended place; v2 VPC range kept; v3 igw attachment kept;
v4 subnet AZ via Segment.group; v5 two tunnel links; v6 inventions.
