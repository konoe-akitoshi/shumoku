# Expanded-search controlled experiment

Run `bun run tmp-test6-expanded-search.mjs`, followed by
`bun run tmp-test6-export-placement.mjs --search`.

Both methods start from the selected coordinates in
`tmp-test6-dependency-placement-report.json` and have a budget of 40000 calls to
the same evaluator. The input hash and baseline cost are checked before running.
The objective function source was verified unchanged after making the existing
module importable. No direction, hierarchy, compactness, or routing terms added.

- Control: continue the existing preconditioned local descent.
- Expanded: local descent plus rigid translations of groups, connected group
  neighborhoods (one/two hops), and all nodes except the fixed root; group swaps;
  random group relocation and rotation. Root-containing groups are excluded from
  swap/relocation/rotation; translation subsets exclude the root.
- Large-move candidates receive local relaxation before acceptance. Some
  temporarily worse candidates are accepted with a decreasing temperature.
  Keep the lowest-cost geometry-feasible checkpoint for output, never an
  overlapping exploratory state. The baseline itself remains a fallback.
- The graph-neighborhood radius defines candidate moves only, not a layout
  objective or an upstream/downstream ordering.
- Equal evaluation-call budget is not precisely equal FLOPs: gradient calls and
  validation overhead differ. Actual elapsed times are included in the report.
- The best feasible state is sampled at block/local/jump checkpoints, not after
  every individual coordinate step. This is one deterministic experiment, not
  a global-optimality or solver-benchmark claim.

## Observed results

| Metric | Previous result | Local continuation | Expanded search |
| --- | ---: | ---: | ---: |
| Objective (lower is better) | 30044814 | 29961114 | 20459182 |
| Drawing bounds area (px², excludes page margins) | 5589564 | 5566613 | 3886129 |
| WAN group area (px²) | 716787 | 711636 | 60983 |
| Internet–ISP A length (px) | 1028 | 1024 | 155 |
| Internet–ISP B length (px) | 816 | 813 | 152 |
| Node/group overlap count | 0 / 0 | 0 / 0 | 0 / 0 |

Expanded search reduced objective by 31.90%, overall bounding area by 30.48%,
and WAN group area by 91.49% relative to the previous result. Local continuation
reduced objective by only 0.28%. Area is a measurement, not an objective term.

All 89 nodes and 160 rendered links remain present. Containment, finite
coordinates, exact root anchoring, and actual rectangle non-overlap were checked.
Padding penalties remain nonzero; zero actual overlaps do not mean all margin
targets are fulfilled. Floor AP directions remain mixed. No conclusion that the
remaining layout is optimal, or that further improvements need new constraints.
