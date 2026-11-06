# The drawing engine

This is a guide for someone about to change `libs/@shumoku/core/src/drawing/`. It says where the
entry is, what each stage decides, which types keep the code honest, and how to change it without
moving a drawing by accident. The code carries the detail; this links to it.

## The entry

`drawNetwork(model, { metrics, hints })` in [draw.ts](draw.ts) turns a `NetworkModel` into a
`Scene` (boxes, groups, wires, ports, hulls).

- `metrics` is a **function** of the model, `(model) => Metrics`. The renderer kit supplies it;
  tests use `testMetrics` in [testing/support.ts](testing/support.ts). Every length the engine
  uses comes from `Metrics` (see [kin.ts](kin.ts) for spacing); do not write pixels in a stage.
- `hints.siblings` (the left-to-right order a person dragged siblings into, by frame) is honoured
  where the drawing is free to choose. `drawNetwork` does **not** read `drawing.order` itself:
  the Editor reads it from the model and passes hints, and the Server passes none.

`boundaryOf(model)` decides what the drawing measures "up" from, in this order, and the first
that gives anything wins, except that the guess in step 4 is always added for the parts left over:

1. `drawing.settings.boundary` (no YAML field or UI sets it today; only code that builds the
   model);
2. `external` / `cloud` nodes and the routing domains that links reach, which the input itself
   says lie outside;
3. the structure's candidates (a node with both a cable and a virtual link), only where the input
   names nothing outside: a source such as NetBox gives many virtual links (tunnels, VM
   interfaces, L2VPNs), and those must not outrank the transit and exchange it also names;
4. for each part of the network that none of these reaches, a guessed upstream
   ([upstream.ts](upstream.ts)): the type ladder (router before switch before AP), then the
   fastest link, then the centre of the part.

## Hosting

What runs on what is drawn inside it ([hosting.ts](hosting.ts)). `hostingOf` decides it once
from the network as written, and `readProblem` and the kit's metrics read its answer:

- A node that others run on (`host:`) is drawn as one box: its own card at the top as the
  heading (`heading`), its guests below in a grid of `ceil(sqrt(count))` columns, so a count, not
  a length, decides it. The box is the host's card item (`guests` on a `NodeItem`, or on a unit's
  member), so every stage after sees one card of that size. A line to a guest ends on the box's
  edge at a port named `<guest>/<port>`; a line between the host and a guest, or two guests of one
  host, runs inside the box: it is not routed, and the scene keeps it in `inner`.
- A redundancy set named as a host (a cluster a VM runs somewhere in) is drawn as a frame round
  its nodes and those guests: `readProblem` adds it to the frames as a group of the drawing's own
  (`/pool/<id>`), hung in the place the set stands in.
- A card drawn inside what it runs on leaves out the facts marked `about: 'hosting'` (the Hosted
  badge, the Host or Host pool row), and is measured the same way (`drawnInPlace`).

A guest that names a place other than its host's stays in that place. The model is not changed.

## The pipeline

`layoutParts` in [layout.ts](layout.ts) runs the stages in this order, each reading only the
values before it. **The rule: no stage reads a length to make a discrete decision.** Orders,
routes and tracks are decided from indices and ranks alone; lengths enter only in `geometry`,
where they are solved, and the one discrete choice made from lengths (the order of runs along a
row) is made once, in the middle of it, and nothing before depends on it.

| Stage | Decides | Reads |
| --- | --- | --- |
| problem ([problem.ts](problem.ts)) | items, frames, lines, levels, satellites: the engine's own input terms | network, structure, metrics, model layers |
| ranks ([ranks.ts](ranks.ts)) | the rank (row) of every item | problem, hints |
| layers ([layers.ts](layers.ts), [layers/](layers/)) | left-to-right order of every row | problem, ranks, sibling hints |
| corridors ([corridors.ts](corridors.ts)) | the free space as a graph (cells, columns, sides, doors), no coordinates | problem, layers |
| routes ([routes.ts](routes.ts)) | each line's walk through the doors: fewest frames it has no business in, then corners, then steps | corridors |
| tracks ([tracks.ts](tracks.ts)) | order of runs in each column, ports on each side, by index | routes, layers |
| needs ([needs.ts](needs.ts)) | how long each box edge must be to hold its ports | problem, tracks |
| geometry ([geometry.ts](geometry.ts), [geometry/](geometry/)) | every coordinate | all of the above |
| diagonals ([diagonals.ts](diagonals.ts)) | the 45° cuts of the corners, as long as the room lets them be | placed wires |
| assemble ([assemble.ts](assemble.ts)) | the `Scene`, moved so its corner is the origin | everything |

Inside **layers** (the order of each row): `basis` looks the problem up the ways the later steps
ask; `lines` cuts a line that crosses ranks into one segment per gap with a dummy in each rank;
`ports` groups the ports of each top and bottom side; `start` lays the hinted order over the
movable children; `sweep` does median sweeps down and up until an order repeats (identified by
`fingerprint` in [layers/types.ts](layers/types.ts)); `sift` swaps neighbours where that cuts
crossings, counting incrementally; `cost` counts crossings (a Fenwick tree); `flatten` turns an
order into rows with places.

Inside **geometry**: `plan` collects what the axes read; `system` makes each axis (its unknowns,
numbered up front, and what frames ask of them); `widths` and `x` lay the horizontal separations,
make frames as narrow as they can be, and let `align` (Brandes and Koepf) straighten lines where
the ledger of equalities allows; [lane-order.ts](lane-order.ts) then orders the runs along each
row from the solved widths; `y` lays flows, **rank bands**, the runs between what lies over and
under them, and ports; [geometry/audit.ts](geometry/audit.ts) counts the crossings that were
drawn against what the stages counted. Both axes are solved by [axis.ts](axis.ts).

## The types that keep it honest

- **Branded keys** ([keys.ts](keys.ts)): ids, frame keys, lane keys, port keys, side keys and
  dummy keys are different types, and the composite ones are built and taken apart only there.
  Do not build a key with a template string elsewhere.
- **`must`** ([must.ts](must.ts)): a lookup that cannot miss fails loudly, naming what was
  looked up. Use `must(map, key, 'what')` instead of `?? 0` where a miss means a bug.
  `assertNever` makes a `switch` over a union complete.
- **Unions**: `Item` is a union on `kind` (node or unit) and `Line` on `role` (oriented,
  unrelated, inside), so a stage cannot read a field its variant does not have.
- **Stage outputs are values**: a stage builds its result as `Building<T>`
  ([building.ts](building.ts), the same type with its lists pushable) and returns the read-only
  `T`; nothing touches it afterwards. `Tracks` and `Routes` are built this way.
- **Constraints are values**: a coordinate sub-stage (`columnWidths`, `siblingsApart`,
  `flowHeights`, `rankBands`, `laneHeights`, `portChain`) **returns** a `Constraints`
  (`sep`, `equal`, `pair`) and never writes into a shared system. The caller joins them with
  `join` in the order the solver should see them, and `systemOf(axis, ...)` makes the system.
  Every unknown, rank-band edges included, is numbered in `axisOf` before any stage runs, so no
  stage allocates (asking an axis for an unnumbered unknown throws). **Order matters**: the
  solver may break ties by index, so keep unknowns and constraints in the order they have.
- **Nothing is numbered by where it is written**: those indices, and every other tie-break,
  come from what the network says, never from its order in the file. `readProblem` takes the
  items in id order and numbers the lines by their written content (`writtenKey`), so the same
  network listed in another order draws the same. A source such as Zabbix or NetBox returns its
  links in whatever order its API gives, and a sync must not redraw the diagram for that. A new
  stage that enumerates something keeps to this; `invariance.test.ts` checks it.

## Changing it safely

- [golden.test.ts](golden.test.ts) pins the whole scene (a hash and a few plain numbers) of the
  sample, the examples, the input fixtures, seeded random networks and generated ones. A refactor
  must pass it **unchanged**. For an intended change to a drawing, run
  `bun x vitest run src/drawing/golden.test.ts -u` from `libs/@shumoku/core`, and read the
  snapshot diff to check that exactly the drawings you meant to change changed.
- When drawings change, bump `RESOLVER_VERSION` in
  `apps/server/api/src/services/topology.ts`; otherwise a deployed Server keeps serving the old
  baked layout.
- What each other test guards:
  - [stability.test.ts](stability.test.ts): decisions (sibling order, cells, door order,
    crossings) do not move when lengths move a little. This is the "no length in a discrete
    decision" rule, tested.
  - [layers.test.ts](layers.test.ts): the incremental cost of sifting equals the cost of the whole
    order.
  - [layout.test.ts](layout.test.ts), [report.test.ts](report.test.ts),
    [wiring-report.test.ts](wiring-report.test.ts): a drawing breaks no rule of containment,
    overlap, flow or level, and the report counts what it says.
  - [ledger.test.ts](ledger.test.ts), [axis.test.ts](axis.test.ts): the equality ledger agrees
    with solving; `solveAxis` keeps every separation and equality on random solvable systems.
  - [geometry/y.test.ts](geometry/y.test.ts): rank bands do not overlap and each box lies in the
    band of its rank; the band constraints can be read as data.
  - [invariance.test.ts](invariance.test.ts): the order a network is written in does not change
    the drawing, whether the nodes or the links are shuffled. A known gap is marked `it.fails`
    in `axis.test.ts`; when it stops failing, the test says so and the marker should go.
  - [upstream.test.ts](upstream.test.ts): the guess never reaches into a part that already has a
    named boundary.
- Style: no `!`, no `any`, `for...of`, no mutated arguments, no pixels written in code. Run
  `bun x biome check <files>` before committing.
