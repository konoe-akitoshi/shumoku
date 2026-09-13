# Dependency-only placement experiment

Run `bun run tmp-test6-dependency-placement.mjs`, then
`bun run tmp-test6-export-placement.mjs --dependency`.

The 89-node / 160-link / 31-group fixture is unchanged. Only the standalone
experiment and exporter change; the production layout engine is untouched.

## Model

- Variables: 178 node coordinates. Internet is exactly fixed at (0, 0).
- Dependencies mean undirected adjacency, not causal or upstream direction.
- Each unique node pair contributes max(0, centre distance - 240)^2.
- Each adjacent group pair contributes max(0, rectangle gap - 100)^2 once.
  Group adjacency is derived solely from cross-group member-node edges.
  These two scales intentionally evaluate the same connectivity at node and
  group levels; there is no additional group topology or degree weighting.
- Group bounds are conservative smooth enclosing rectangles of their members,
  using log-sum-exp with temperature 8px and padding 20px horizontal / 36px
  vertical. They are not independent variables. Thus an internal-node move can
  affect both group relationship and group non-overlap costs in the same gradient.
  The smoothing adds small size-dependent slack; there is no fixed minimum size,
  separate cohesion term, or group-shrink objective. At rendering time the same
  smooth bounds are used (no after-the-fact packing or resizing).
- Node/group overlap uses finite squared penalties of weight 3000 with padded
  harmonic penetration. Geometric validation checks actual rectangle overlaps;
  zero counts do not certify that every requested padding distance is satisfied.
- No direction, root half-plane, hop hierarchy, role tier, central-axis pull,
  floor-peer height preference, or edge-routing/crossing objective.

## Numerical choices, not hidden layout requirements

Three seeded random starts use random group centres and random member offsets;
there is no polar/hop/degree ordering or non-overlap initial packing. Joint
preconditioned gradient descent runs up to 10000 steps per start with backtracking.
The root is projected to (0, 0) on every step. Candidate selection first minimizes
actual overlap counts, then the objective. These are local searches, not proofs
of an optimum or a general hard-constraint guarantee. Orientation is not fixed;
rectangle shapes still distinguish horizontal and vertical directions.

The report records the input hash, gradient finite-difference check, every
candidate's losses/violations, resulting coordinates, and group-derived edges.
Labels and colours still display metadata but do not feed into dependency weights.
