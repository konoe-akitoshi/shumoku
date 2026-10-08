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
