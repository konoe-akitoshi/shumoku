Key for round 14 (written before the runs), current model.
Facts: br1, br2 in AS64500 and in DC-A; AS64510/20/30/40 known only as ASes (no routers named);
a cable br1--(AS64510's router) 10G with an eBGP session; IX-T peering LAN 198.51.100.0/24 with
br2 .10, AS64520 .20, AS64530 .30; eBGP br2--AS64520 (peer); no session with AS64530; eBGP
br2--AS64540 (transit, we are customer), path unknown; relationships: AS64510 and AS64540 are
our providers (direction), AS64520 a peer.
Expected trouble in the current model: which AS a router belongs to (group is a place only;
routingDomains are VPC/VRF); an AS with no named router; the provider/customer direction
(links are undirected); a BGP session as opposed to a cable.
Counts: a1 AS membership of br1/br2 kept (how); a2 other ASes as nodes; a3 IX as a segment with
the three addresses; a4 sessions written (how) and AS64530 without one; a5 direction of transit
kept (how); a6 inventions (router names, cables for the AS64540 session).
