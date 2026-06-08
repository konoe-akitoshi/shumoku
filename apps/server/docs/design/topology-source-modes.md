# Topology Source Modes, Region Scope & Presence Unification

Status: design (2026-06-08). Implementation split into 5 PRs (see end).

Builds on [topology-source-priority-merge.md](./topology-source-priority-merge.md)
(all-sources-equal field merge), [db-native-persistence.md](./db-native-persistence.md)
(contribution store), and [topology-composition-store.md](./topology-composition-store.md).

## Motivation

A topology is composed from N sources (`topology_data_sources`) plus the project
overlay, folded at read time by `resolve()`. Today every source contributes the
same way: its nodes are asserted present, its links pass straight through, and the
union of everything is shown. Operators need finer control over *how each source
participates*:

- **A source should be able to define a scope** ("this NetBox feed owns the DC
  region; outside it, ignore what it says") and let other sources fill gaps
  **within** that scope.
- **A source should be able to enrich without asserting existence** (a metrics or
  dependency feed that knows facts about devices but should not, by itself, make
  devices appear).
- **Disconnected nodes** (a Zabbix host with no LLDP neighbor) should be hideable.
- **The same physical link** observed by two sources should resolve to one edge.

These were running as separate threads; this doc separates them into five
orthogonal axes and specifies each.

## The five axes

| Axis | Concern | Touches `resolve()` |
|------|---------|---------------------|
| A. Link-layer merge | Cross-source link dedup + field merge | yes |
| B. Presence unification | scoop / anchor / hide as one resolved claim | yes |
| C. Region scope | Subgraph becomes a first-class identity-bearing region | yes |
| D. Composition modes | Per-source role wiring (Scoping / Additive / Enrichment) | yes |
| E. hideDisconnected | Post-resolve display filter | no |

## Core model decisions

### Presence is one ternary claim (Axis B)

Every contribution makes, per element, one of three claims:

- **scoop** (`present`) — positive: "this element exists." (Default.)
- **hide** — negative: "this element should not exist." (Stored as `exclusions`.)
- **anchor** (`NULL` presence) — *no* claim: carries identity / fields /
  attachments only, to ride onto an element someone else scoops.

Resolution (per identity cluster):

1. If the highest-priority **claim** is `hide` → cluster is dropped.
2. Else if any member is a **scoop** → present.
3. Else (only **anchors**) → dropped.

Anchors contribute identity, fields, metadata and attachments to the cluster they
land on, but never confer presence. This is what makes "the project overlay
attaches a metrics-binding to a node" safe: the overlay node is an anchor, so when
every source stops observing the device, the binding evaporates with it instead of
leaving a ghost node. `anchor` is the missing third state — the schema reserved
`presence NULL` for it; the codec just never produced it before.

There is **no human/machine layer**: "the project's edit wins" is still just
"intrinsic has `+Infinity` priority." Presence folds through the same priority
machinery as every other field.

### Regions are first-class identity-bearing entities (Axis C)

A subgraph stops being a pure visual container. It gains, like a Node:

- `identity` — a multi-key identity (`{ name?, keys: Record<ns,value> }`, e.g.
  `zabbix-hostgroup:98`, `netbox-site:backbone`, `name:backbone`). Regions from
  different sources merge by **any-key match**, exactly like node clustering. This
  also fixes the old "subgraphs can't merge / empty boxes from the losing source"
  problem.
- `membership` — zero or more criteria (`{ attr, op, value }` over
  `hostgroup | subnet | name | tag | …`). A node belongs to a region if its
  explicit `parent` resolves to that region's cluster **or** its attributes match
  any membership criterion.

This is why a lower source can fill a gap *within* a region: membership is a
**predicate**, not the enumerated set the upper source happened to scoop. A device
the upper source missed still lands in the region if it matches a criterion.

**Bootstrap caveat (same as node identity):** cross-source region merge needs a
*shared* key. Either sources emit a normalized key (both Zabbix and NetBox emit
`name:backbone`) or the operator maps them on the overlay. There is no magic that
equates `zabbix-hostgroup:98` with `netbox-site:backbone` without one of those.

Regions nest via `parent` and merge via `identity` — both supported from the start.

### Composition modes are per-source, two independent knobs (Axis D)

On the **attachment row** (`topology_data_sources`, not `data_sources` — the same
source can play different roles in different topologies):

- `node_contribution`: `scoop` (default) | `anchor`
- `link_contribution`: `add` (default) | `update`
- `scope_role`: `NULL` (default) | `scoping`

Node and link knobs are **independent** (decided): an Enrichment source can be
`node_contribution=anchor` (adds no devices) yet `link_contribution=add` (asserts a
new dependency between two already-present devices) — the "knows dependencies, not
devices" case.

UI presents **role presets** over these knobs; raw knobs are an advanced surface.

| Preset | node | link | scope_role | meaning |
|--------|------|------|-----------|---------|
| **Additive** | scoop | add | NULL | adds nodes+links within the scope |
| **Enrichment** | anchor | update | NULL | fills fields of existing entities only |
| **Scoping** (override) | scoop | add | scoping | force this source to define the scope even when it isn't top-priority |

**Scope is ordering-driven (decided model 2).** The highest-priority topology
SOURCE (the intrinsic overlay is excluded — it's curation, not coverage) defines
the closed world: its regions confine every lower-priority source to within them.
There is no per-source "is this the scope?" flag for the common case — priority
already orders the sources, and the top one's coverage *is* the scope. `scope_role`
is demoted to a manual **override** (force a non-top source to also define scope).
Scope only activates when a scope-defining source actually contributes regions; a
single source, or sources with no regions, resolve as an open-world union.

The scope **confines** lower sources — it never drops curation or the scope
owner's own nodes. A cluster survives iff it (a) has an intrinsic member, (b) has a
member from a scope-defining source (its own coverage; a lower source merged into
such a cluster rides along), (c) lands in a closed region by parent, or (d) matches
a closed region's membership predicate. Otherwise it's an out-of-range node from a
lower source → dropped (its links dangle and drop too).

> For "Additive = ADD new within the scope" to differ from Enrichment, the scope
> must be **predicate-based** (region `membership`): a brand-new lower-source node
> can only be "within scope" if it matches a region predicate. With an enumeration-
> only scope (a source that emits subgraphs but no `membership`), a new lower node
> can't be placed in-region, so Additive degenerates to Enrichment (only
> identity-merged nodes survive). This needs plugins to emit region membership.

Resolve wiring:

- `node_contribution=anchor` → the source's nodes are folded as `presence:'anchor'`
  (Axis B handles the rest).
- `link_contribution=update` → the source's links contribute fields to an existing
  link cluster but never create a new link cluster.
- scope → the highest-priority source's regions (or an override source's) are
  closed; `clusterInClosedScope` confines lower sources to them.

### hideDisconnected is post-resolve display (Axis E)

`overlay.settings.hideDisconnected: boolean`. Evaluated **after** resolve, on the
fully-merged in-scope graph — never per-source (degree is only defined on the
merged graph; another in-region source may supply the link). Discovered-only
degree-0 nodes are dropped; nodes carrying an intrinsic (operator-placed)
contribution are kept even at degree 0.

## Invariants / ratified defaults

- Explicit `parent` outranks membership-criteria match.
- A node matching multiple regions resolves by priority, then specificity.
- Link field merge uses the same priority rule (`priority desc, capturedAt desc`)
  as nodes.
- Naming: the per-source role is `compositionRole` / the columns above — **not**
  `mode` (which collides with `DiscoveryMode = auto|observe|disabled`).

## PR breakdown

`resolve.ts`-touching PRs are serialized to avoid merge conflicts.

- **PR1 — E (hideDisconnected).** Independent (no resolve internals). First.
- **PR2 — B (presence unify + anchor).** Foundation; fixes binding-ghost.
- **PR3 — A (link dedup).**
- **PR4 — C (region as first-class entity).**
- **PR5 — D (composition modes).** Migration `018` (next free number; 017 latest).
  Needs B + C. May split 5a (schema/types/service/API/UI, behavior still Additive)
  / 5b (resolve wiring).
