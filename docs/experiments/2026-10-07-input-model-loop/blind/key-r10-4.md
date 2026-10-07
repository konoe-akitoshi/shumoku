Key for round 10 test 4 (written before the runs). Task task-r10-2.md. Both variants are the model
as adopted (product path, software, Segment.group, VPC as a node, parallel links). A2 adds
Node.prefix ("an address range the node holds as a whole, such as a VPC's").

Expected: VPC main as a node in sub-a and sub-c, igw-1 virtual link to main, sub-a/sub-c with
groups for the AZs, two rt-1--tgw-1 links.
A1: 10.0.0.0/16 has no field -> description (a fact in free text) or lost.
A2: main.prefix 10.0.0.0/16. Misuse to watch: prefix on rt-1 or the hosts (e.g. 192.168.10.0/24),
which would be writing a segment's range on a router.
Counts: r1 VPC range kept in a field; r2 range lost; r3 prefix misused; plus anything that
regressed from test 3 (product, software, AZ, igw, tunnels).
