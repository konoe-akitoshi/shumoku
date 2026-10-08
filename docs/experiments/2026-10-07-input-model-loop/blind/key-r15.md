Key for round 15 (written before the runs). Same task as round 14 (task-r14.md).
A: Node.asn; another AS's router is a node with no label (not assumed); sessions are virtual links.
B: AutonomousSystem elements; Node.as; a link may end at { as } when the router is not known.
Both: assumed and virtual got the same new wording, so the two differ only in how an AS is held.

Correct answer under A:
- br1, br2: asn 64500, group DC-A.
- nodes for the routers of AS64510, AS64520, AS64530 (asn set, no label, not assumed).
  AS64540: either a router node (no label) or left out; a session to it is a virtual link with no
  cable. Inventing a cable or a path for it is an error.
- cable br1:xe-0/0/0 -- AS64510 router, 10G. The eBGP session: on that link's description or a
  virtual link; either is fine.
- segment IX-T 198.51.100.0/24 with br2 .10, AS64520 router .20, AS64530 router .30.
- virtual link br2 -- AS64520 router (eBGP); none to AS64530.
- provider/customer/peer: description only.
Correct answer under B: the same, but the ASes are autonomousSystems entries, nodes carry `as`,
and AS64540's session may be a virtual link br2 -- { as: 64540 } instead of a node.
Counts: c1 br1/br2 AS kept; c2 other AS routers without assumed; c3 IX segment with 3 addresses;
c4 sessions written, none for AS64530; c5 nothing invented for AS64540; c6 parse errors;
c7 notes of confusion (clustered).
Prediction: A and B both pass c1–c5 mostly; B shows a split between node and { as } ends for
AS64510/20/30 (two ways to write one thing), A does not.

Round 16 (written before the runs). Round 15 showed: assumed on unnamed routers 10/12 (worse than
round 14's 4/6), the br1 cable marked virtual 4/12, AS as routing domains in A 3/6. The new
wordings named the very cases and drew writers to them. Round 16 reverts assumed to the round-14
wording, moves "name not known" to label, says virtual means "no cable of its own", and says an AS
is not a routing domain. Same task, same counts, plus c8 cable marked virtual, c9 AS as routing
domain. Prediction: c8 and c9 drop to about 0; assumed back to about round 14's rate or lower.

Round 16 result: A 5 wrong counts over 6 writers, B 8; assumed on unnamed routers A 0/6, B 1/6;
cable marked virtual A 0/6, B 1/6; B split AS64540 between a node and { as } (2/6) and mixed
`{node, as}` once. A kept. The remaining shared confusion is AS64540: "no cable of its own" claims
there is no cable, but whether the session crosses a cable of its own is not known (a2, b2 notes).
Round 17 (A only, written before the run): virtual means "not a cable but runs over other links",
and a cable a session runs over is its own link. So every session is a virtual link, br1 has a
cable and a virtual session link, and AS64540 is a virtual link with nothing claimed about the
path. Prediction: c4/c5 errors drop; br1 shows both links in most outputs.
