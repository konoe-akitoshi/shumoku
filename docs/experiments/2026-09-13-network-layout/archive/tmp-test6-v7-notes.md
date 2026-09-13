# V7: boundary-first, two-stage placement

Run `bun run tmp-test6-v7-boundary.mjs`, then
`bun run tmp-test6-export-placement.mjs --v7`.

The original 89 nodes, 160 links and 31 parent groups are retained. This is a
standalone experiment; no production package or input fixture is modified.

## 1. Subgraph boundaries first

Estimate each rectangle's capacity using node count, maximum label width,
ceil(sqrt(count)) columns and enough rows, with space for labels/terminals.
These are size estimates, not a final internal grid. Sizes stay fixed afterward;
there is no feedback resizing from stage 2 in this experiment.

Aggregate undirected cross-group node adjacency. One unique node pair contributes
one unit of weight; parallel physical links remain in rendering but do not multiply
macro attraction. Minimize weighted squared group-centre distances with rectangular
non-overlap penalties. Use four starts, local descent, group swaps/relocations.
The WAN group centre is fixed at (0, 0) only to remove translation freedom.
There are no role tiers, upstream inference or vertical direction constraints.

## 2. Plot explicit boundary terminals

Each of the 98 cross-group link records gets an exit and entry terminal: 196 total.
The ray toward the neighboring group selects the facing side and an ideal point.
Terminals are sorted and separated along that side, away from the corners.
Parallel links retain distinct terminal records and points. Terminals are logical
drawing connection points, not newly invented network devices or physical ports.

## 3. Place nodes within fixed boundaries

For each group independently, minimize squared internal connection lengths and
distances from externally connected nodes to their fixed boundary terminals.
Eight initial slot permutations plus node swaps and continuous local descent are
tried. Grid slots initialize only; final coordinates remain continuous. Containment
is projected exactly, actual non-overlap is checked, and the best feasible internal
candidate is selected. Metadata roles affect styling only.

## 4. Render connections

Cross-group path: node perimeter -> exit terminal -> exterior polyline -> entry
terminal -> node perimeter. Exterior paths use a visibility graph around frames
with 10px clearance. This routing is a rendering-only step and does not feed back
into either placement stage. It prevents transit through unrelated subgraphs;
line crossings/shared segments are not optimized. Internal lines remain straight
and may pass behind unrelated node glyphs. Brown circles display boundary terminals.

## Verification and limits

Finite-difference gradients checked for the macro objective and all 31 internal
objectives. Verify unchanged macro bounds during internal layout, original input
hash, all node/link records, node/group non-overlap, node containment, terminal-on-
boundary geometry, exit/entry coverage, and no exterior-frame penetration.
All geometric violation counts are zero for this fixture. Penalty objectives and
finite local search do not guarantee a globally optimal layout. Capacity estimates
can leave unused space. V7 changes both objective and architecture, so its cost
must not be compared numerically with the previous joint-layout experiments.

Outputs: full diagram, placement-only diagram, macro-only diagram, and JSON report
with exact node coordinates, fixed bounds, terminals and every link polyline.
