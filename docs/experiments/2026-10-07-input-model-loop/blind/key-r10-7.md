Key for round 10 test 7 (written before the runs). Task task-r10-7.md (test 2's task + a VRF).
C1 = model as adopted (VPC as a node present in its subnets, range in Node.prefix, attachments as
virtual links). C2 = a top-level routed network list (VPC, VRF) that segments and nodes belong to
(Segment.network, Node.network); no Node.prefix, no VPC node.

Expected C1: main node in sub-a/sub-c ([]), prefix 10.0.0.0/16, igw-1 virtual link to main,
tgw-1 in sub-a/sub-c; VRF guest: no home -> description, or a made-up node (count both).
Expected C2: networks main (10.0.0.0/16) and guest; sub-a/sub-c network main; vlan20 network guest;
igw-1 network main; tgw-1 in sub-a/sub-c (and/or network main).
Both: ap-1 link to rt-1 lan2 carrying vlan20, ap-1 192.168.20.5 in vlan20.

Counts per writer: m1 every "belongs to the VPC" fact written (subnets, igw, tgw);
m2 written once, in one way; m3 host misused for belonging; m4 VRF kept in structure;
m5 inventions; m6 regressions (product, software, AZ, tunnels).
