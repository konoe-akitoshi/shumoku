Key for round 18 (written before the runs). Current model (r11/types-r16a.ts). Real public data.
Expected to fit: border routers as nodes with asn 290; cpe, ncs5501se.kote, wxd, wxt-1 as nodes;
cables with ports; IX LANs as segments with AS290's address under the border router that holds
it — but which router holds which address is NOT stated (JPIX/DIX-IE are behind mx204's path,
JPNAP behind ncs57c3's, BBIX behind cisco8712's; reading the path is an inference the writer may
make, and should say so); the segments carried over a cpe link (link.segments); transit
providers as nodes (name unknown) or left out.
Expected trouble (prediction):
- t1 dual stack: a segment has one prefix; an IX LAN has an IPv4 and an IPv6 prefix.
- t2 IX/transit reached through a provider's switch: does the IX segment end at ncs5501se.kote
  (link to segment) and also reach mx204? Both ends of a link are in its segments.
- t3 peers counted but not named (34 on JPIX): no way to say "34 unnamed peers".
- t4 route server: a node on the IX LAN with no address given.
- t5 wavelengths whose mapping to JPNAP is unknown.
- t6 transit vs peer: description only.
Counts: c1 parse ok; c2 which router holds each IX address, and whether it was flagged as
inferred; c3 how dual stack was written; c4 IX reached through ncs5501se.kote; c5 peers counts;
c6 route server; c7 inventions (names, ASNs of KDDI/OCN/SoftBank not given, cables).

Round 18 result (current model): parse ok 2/6 (3 wrote addresses under `as290`, 1 a bad end).
Who holds the IX address: as290 3, ncs5501se.kote 2 (invented), border router by the path 1 (sol,
flagged as inferred). Dual stack confused 5/6. No writer carried an IX segment along the path to
the border router. Unknown optical path confused 6/6. Unnamed counted peers 6/6.
The user's reading of the public maps: the router that speaks for the AS is the one at the
connection point, so who holds an IX address follows from the path.

Round 19 (written before the runs), same task: prefix may be a list; link.segments says a segment
reached through other devices is carried on each link of the way; virtual says a link whose way
is not known is neither virtual nor given a cable. No case is named (round 15's lesson).
Prediction: parse ok 5/6 or more; dual stack as one segment with two prefixes in most; IX
addresses under the border router at the end of the path in most, with segments carried along
the cpe links; JPNAP as a link from ncs57c3 (or wxd/wxt-1) to the JPNAP segment, not virtual.
Peers counted but unnamed stay in description (no change made for them).

Round 19 result: dual stack as one segment with a prefix list 6/6 (was confused 5/6). Carriage
along the path 1/6 and JPNAP as a plain link 1/6: the new sentences did not move luna. On reading
the task again, neither the holder of an IX address nor the carriage is stated, so leaving them
out is not a loss; the key over-asked. Real failures left: AS290 written as a routing domain 4/6
(the sentence saying an AS is not one did not help), invented optical paths 3/6, addresses put on
a provider's switch 3/6.
Mechanism for the routing domain: in routing, "routing domain" is another name for an AS (ISO
10589 calls the AS a routing domain), so the name itself draws the AS in.
Round 20 (written before the runs): rename only. v0 routingDomains, v1 vrfs, v2 routingTables,
v3 routingInstances. Tasks r18 (ShowNet) and r10-7 (VRF and VPC), luna x5 each.
Counts: e1 an AS written as one (r18); e2 the guest VRF and the VPC both written as one (r10-7);
e3 an AWS route table or a subnet written as one (r10-7). Prediction: v1-v3 cut e1 to about 0;
v1 may lose the VPC (a VPC is not usually called a VRF), v2 may draw AWS route tables.

Round 20 result. AS290 written into the collection, r18 (of 5): v0 routingDomains 5, v1 vrfs 2,
v2 routingTables 3, v3 routingInstances 5. VPC kept, r10-7: v0 4, v1 0, v2 2, v3 5. A rename does
not remove the pull and v1/v2 lose the VPC; the name stays. The pull follows the task's wording:
the addresses are given as AS290's, and writers hang them, or the border routers, on an AS290
container (address key or link end). In round 16, where the addresses were given per router,
an AS as a routing domain was 0-1 of 6. So the trouble is the AS-level fact itself (item 4 in the
report), not the name. Kept: prefix list. Kept: the virtual sentence (a link whose way is not
known); it states a rule nothing else states. Reverted: the carriage sentence on segments; it
follows from "both ends are in each" and moved no writer.
