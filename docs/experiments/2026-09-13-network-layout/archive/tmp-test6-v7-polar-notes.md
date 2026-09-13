# V7 polar macro / Cartesian micro variant

Run `bun run tmp-test6-v7-boundary.mjs --polar`, then
`bun run tmp-test6-export-placement.mjs --v7-polar`.
The original V7 output files are preserved; this mode writes `tmp-test6-v7-polar*`.

For group g and member i:

    group centre = (r_g cos(theta_g), r_g sin(theta_g))
    node world position = group centre + (localX_i, localY_i)

The local axes are fixed horizontal/vertical; theta changes group location but
does not rotate its rectangle or its nodes. Boundary terminals convert the chosen
external arrangement into fixed attachment targets for the internal Cartesian
optimizer. Frame sizing, terminal assignment, micro objective/search and exterior
routing are unchanged from V7. Radius/angle and localX/localY are recorded in JSON.

## What changed in the macro search

- Same Cartesian initial positions for each of the four seeds, converted to polar.
- Same macro objective in actual drawing coordinates: weighted connected-centre
  squared distances and axis-aligned rectangular overlap penalties.
- Chain-rule gradients in radius/angle, checked with finite differences.
- Alternate radial-only, angular-only, joint updates with backtracking.
- Trial displacements capped at 300px / 0.35rad per local step for numerical
  stability, not bounds on final positions. Negative radius is normalized by
  adding pi to the angle. The WAN group remains at radius zero.
- Discrete trials exchange group angles, relocate along arcs, or relocate radially.
- No fixed radii, rings, sectors, hop levels, role tiers, or preferred direction.

Coordinate reparameterization does not change the feasible layouts or define a
new meaning of dependency. The search trajectories and discrete proposals change.
This is not an equal-evaluation-budget benchmark. One deterministic run reduced
the macro objective from 65409446.22 to 60659012.85 (7.26%). This does not establish
that polar coordinates generally outperform Cartesian coordinates.

## Verification

Same input hash and all 31 frame sizes as V7. Preserve 89 nodes and 160 links,
including all 98 cross-group links and 196 boundary terminals. Zero actual node
overlaps, group overlaps, containment violations, off-boundary terminals, missing
terminal routes, or exterior-frame piercings. Polar gradient relative error about
1.06e-6. Root group centre remains (0, 0). Conversion and local/global composition
are checked against recorded positions. Frames are unchanged during micro layout.

The macro-only SVG includes faint 500px radial guides for interpretation only;
these are not layout constraints. The full drawing deliberately omits those guides.
The root is the polar origin, not necessarily the visual centre of the final
bounds. More connected groups can still settle away from it under this objective.
