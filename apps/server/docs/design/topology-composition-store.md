# Topology composition store — DB refactor plan

The topology tab's **composition** (the resolved current graph + the metrics
mapping) is not actually DB-managed. JSON at the boundary is great and stays;
the *internal* model needs to be a real, identity-keyed store so it stops
hitting perf and re-sync-correctness walls. This is the plan: problems first
(so the schema is right the first time — it's hard to change later), then the
target model, then phasing.

Scope: **data model only.** Diagram render (SVG DOM / client layout) and poll
orchestration (subscriber scoping, plugin call batching) are real but separate
— noted at the end, not the subject here.

## Mental model: two axes on one hub

The **resolved entity** is the hub; two axes meet on it:

- **Axis 1 — composition (structure):** `sources → entity (identity-merged) →
  diagram`. What the device is, where it sits, how it connects.
- **Axis 2 — metrics dependency (the mapping):** `entity → metrics provider`
  (which source/host/port supplies its live values). Mapping is **not a module**
  — it's a *dependency-resolution field* on the entity (a resolved reference),
  resolved by identity + LLDP + fuzzy as the resolution function. The internal
  algorithms are how that one field is filled, not grounds for a separate
  subsystem.

The **diagram** is axis-1 rendered with axis-2's live values painted on.
Human/authored input is not a third axis — it's a contributor on both, carried
by provenance. The three tabs map to this: Sources (inputs to both axes),
Composition (the entity + both axes' resolved state), Diagram (presentation).
Everything below follows from putting both axes on the identity-keyed entity.

## Current state (survey)

### Where composition lives today
| Data | Storage | Form |
| --- | --- | --- |
| Per-source captured graph | `topology_observations.graph_json` | JSON blob (append-only history) |
| Authored / Manual graph | `data_sources.config_json.graph` (type=`manual`) | JSON blob nested in config |
| **Resolved current graph** | **in-memory only** (`TopologyService.cache`) | recomputed every read |
| Layout | in-memory (`cache`) + **recomputed client-side** too | not persisted |
| Metrics mapping | `topologies.mapping_json` | JSON blob, keyed by element id |
| Source attachments (m2m) | `topology_data_sources` | ✅ relational |
| Observation/source metadata | columns on the tables above | ✅ relational |

So: **metadata is relational; composition payload is blobs; the resolved current
state is RAM-only and recomputed.** (`services/topology.ts:408-545`,
`services/observations.ts`, `observation/resolve.ts`.)

### How resolve works (and the load-bearing bug)
`resolve()` (`observation/resolve.ts:214-297`) clusters nodes **by identity**
(any-key match over mgmtIp/chassisId/sysName/vendorIds) — clustering itself is
stable. **But the cluster's display id is positional:**
`id = \`discovered:${nextSynthId++}\`` (`resolve.ts:249`), reset to 0 each run.
The metrics mapping is keyed by that id (`mapping.nodes["discovered:5"]`).

⇒ **Re-sync follow is broken at the root**: clustering is identity-stable, but
the *id handed to the mapping is order-dependent*, so adding/removing/reordering
equipment shifts `discovered:N` and the mapping silently mis-attaches or
detaches. Links additionally store an interface **name**, so an interface rename
breaks them too. (Confirmed against live data earlier: node→host stores a stable
`hostId`, but the *key* is the unstable `discovered:N`.)

### Recompute / cost (DB-relevant)
- `getParsed()` runs `resolveObservations` **+ `computeNetworkLayout`** on every
  read and **every metrics poll cycle** unless the RAM cache hits
  (`topology.ts:472-545`; poll at `server.ts:354`). Cache is busted by any
  mapping/source/authored edit, so operator activity forces full re-resolve +
  re-layout.
- The resolved graph is never persisted → cold start and every cache-miss pays
  full resolve+layout.
- Observations are uncompressed full-graph blobs; retention now runs on write
  (PR #357) so growth is bounded.

(Mapping match O(N×H), plugin poll fan-out O(N+M) API calls, poll-all-topologies
— real, but those are compute/orchestration, tracked in `performance-scaling.md`.)

## Invariants the new model MUST honor

From the already-shipped identity / priority-merge / attachment model
(`topology-foundation-identity.md`, `topology-source-priority-merge.md`,
`topology-node-attachments.md`):

1. **Clustering is by identity, orthogonal to priority.** Identity keys decide
   *same device*; priority decides *whose field wins*. Never bridge-cluster by
   priority.
2. **All sources are equal contributions + priority merge per field.** No
   observed/authored layer split; human is just the top-priority contribution.
3. **Human contribution is symmetric** (add / override / **delete via
   `suppressedAttachments`**) and **survives re-scan**. Reset clears both.
4. **Provenance is annotation, not a layer boundary** (don't gate editability
   on it).
5. **Port identity is separate from node identity** (ifName strong, ifIndex weak
   — never ifIndex alone); mapping binds by port identity.
6. **Exclusions / overrides are identity-keyed**, so they survive id changes.

The new store must express the same semantics — ideally by *reusing* this
machinery, not paralleling it.

## Target model

The keystone is to **model the mapping as an identity-keyed field on the resolved
element** (axis 2), not a side store. Once it lives inside resolve, re-sync
follow is emergent and the positional `discovered:N` id stops mattering —
confirmed: the mapping is the *only* thing that persists resolved node ids
(dashboards/widgets key on `topologyId` and resolve nodes live), so a stable
display id is **not needed**.

### 1. Mapping = identity-keyed dependency field (the keystone)
Model the binding as a **`metrics-binding` attachment** on the resolved node /
port, keyed by **identity** (node identity for nodes, port identity for links),
reusing the existing `Attachment` + fold + provenance + `suppressedAttachments`
machinery that already survives re-sync. `resolve()` folds it onto the
identity-matched element every run, so:
- it follows re-sync / reorder / add-remove **by construction** — no stable-id
  registry, no separate `mapping_binding` table (supersedes that part of
  `metrics-mapping-model.md`);
- a **metrics source is just another contribution**: it can emit binding
  attachments as observations, so auto-map becomes mostly *observed* and the
  human only overrides (add / change / suppress) via the same priority-merge.

Three layers:
- **binding** (element-identity ↔ source/host/port-identity) — the durable field,
  carried by contributions, resolved by identity.
- **resolution** (port identity → concrete counter id, e.g. Zabbix item id) — a
  re-validated **cache** (`resolved_at`-stamped, RAM or column); never the source
  of truth, because item ids are volatile.
- **value** (bps / status) — never stored; fetched per poll.

### 2. Resolved current graph — materialize, don't recompute-per-poll
Persist the resolver output so reads/polls don't re-resolve + re-layout each
time: store the resolved graph (and layout) per topology as a derived artifact,
recomputed only when an observation/authored edit invalidates it — not on every
metrics poll. Lowest risk; kills the "resolve+layout every cycle" cost; keeps the
NetworkGraph shape.

**Deferred (YAGNI): full normalization.** Normalizing into
`entity`/`entity_identity`/`entity_port`/`entity_link` tables (with
`entity_identity(kind,value) UNIQUE` minting persistent stable ids) would enable
SQL over the graph — but it introduces the **entity merge/split** problem (a
bridging observation merges two *persisted* entities). The §1 attachment model
avoids this entirely: resolve re-clusters in memory each run, deterministically,
with no persisted merge state. Normalize only on a demonstrated query need.

### 3. Keep as-is (do NOT over-normalize)
- **Raw observations** = JSON blobs (append-only document history). Correct.
- **Plugin `config_json`, `options_json`, `labels_json`** = heterogeneous small
  blobs. Fine.
- Authored graph: move it **out of `config_json.graph`** into its own store
  (it's content, not config) — but still a graph document, not normalized.

### 4. Subgraph hierarchy (axis 1, no identity) — reserve a slot
Subgraphs are the *grouping/nesting* part of axis-1 structure, and they are **not
identity-bearing** — so they do NOT fit the identity-keyed entity model. The
store must model them as their own concern: a **container tree** (id, label,
parent, children) plus **membership** (which entity belongs to which container).

This matters because subgraph nesting is **currently broken** (tracked for a
separate PR), and the store must be able to express the fix, not fight it. Root
causes in today's resolve (`resolve.ts` `foldSubgraphs` / `namespaceSourceSubgraphs`):
- membership is **double-encoded** — `node.parent` *and* `subgraph.children[]` —
  and `node.parent` is picked by per-field priority while `children[]` is carried
  verbatim, so the two **desync** (a container claims a node that no longer
  parents into it);
- subgraphs have **no identity**, so each source is namespaced (`sourceId:id`)
  and the *same logical group* from two sources **fragments** instead of merging;
- authored vs source namespacing **breaks cross-layer parent refs** (an authored
  container holding a discovered subgraph) and leaves **orphan parents**.

Design stance for the store:
- **Single source of truth for membership** — entity→container edge (i.e.
  `node.parent`), derive `children[]` for the JSON boundary; never persist both
  as independent truth.
- Containers are an **axis-1 tree**, resolved/merged separately from identity
  entities; cross-source grouping merge (do two sources' "Rack-1" unify?) is an
  **open decision** — likely keep per-source unless an explicit grouping key is
  introduced.
- The nesting-fix PR is **axis-1 only**, largely orthogonal to the mapping
  (axis-2) work — it can land independently, but the store schema must already
  carry containers + membership so it has somewhere to live.

### Boundary
The API keeps emitting `NetworkGraph` / `TopologyContext` JSON, generated from
the store. JSON is the wire/render format; the DB is the internal truth.

## Phasing (each independently shippable; schema-lock-aware)

1. **Port identity (T0)** — sources stamp `NodePort.identity` (ifName/ifIndex/
   mac); prerequisite for identity-based *link* bindings.
2. **Mapping = `metrics-binding` attachment (the keystone)** — key by node / port
   identity; metrics sources contribute binding attachments; humans override via
   attachment + suppress. Migrate `mapping_json` into attachments
   (`origin='human'`), then **drop `mapping_json`**. Drop per-poll name resolution
   (read bound port identity; resolve→item-id cached). Binding follows re-sync by
   construction — no stable-id work needed.
3. **Materialized resolved graph** + decouple metrics poll from resolve.
4. **Retire old paths** — authored graph out of `config_json` into its own store;
   drop legacy `topologies.topology_source_id` / `metrics_source_id`; decide the
   file-based topology path (`topologyManager`).
5. *(Deferred)* full graph normalization + identity registry — only on a
   demonstrated query need.

## Risks / open decisions

1. **Entity merge/split** — only arises *if* we do the deferred full
   normalization (persisted stable ids). The shipping attachment model needs no
   persisted registry; resolve re-clusters in memory each run, so the problem
   doesn't exist for it. Flag it for the deferred phase only (rules + tests then).
2. **Migration of existing `mapping_json`** — re-key via the current resolved
   graph at migrate time (`origin='human'`, operator-confirmed). One-shot.
3. **Ports need an attachment slot** — the `metrics-binding` attachment for links
   lives on `NodePort` (nodes already have `attachments`). Small core change;
   confirm it folds in resolve like node attachments.
4. **Materialized vs normalized resolved graph** — start materialized; normalize
   only if SQL queries over nodes/links become needed.
5. **Cache-busting granularity** — today any edit clears the whole parsed cache;
   the materialized store should invalidate per topology, ideally per source.

## Information architecture (tabs follow the model)

Once binding is emergent (a metrics source is just another identity contribution,
not a separate module), the topology tab's sub-tabs collapse to match the data
model's three layers — **inputs → resolved composition → output**.

Today (5 tabs, with the resolved-curation layer split three ways):
- Diagram · Sources · Discovery (per-node policy + observations) · Mapping
  (node→host / link→interface) · Resolved (debug JSON)

Target (3 tabs):
| Tab | What | Absorbs |
| --- | --- | --- |
| **Sources** | inputs — which sources contribute (topology / metrics / manual), priority, sync | Sources |
| **Composition (構成)** | the resolved entities; per-entity detail holds identity + provenance (who observed it), field overrides, **discovery policy**, **metrics-binding override** (the old Mapping), hide/exclude; raw observations + resolved JSON as a debug subview | **Discovery + Mapping + Resolved** |
| **Diagram** | render + live metrics | Diagram |

- **Mapping stops being a tab** — it becomes the metrics-binding override section
  in an element's detail. Binding is mostly emergent (identity merge), so "auto-map
  all" dissolves into a Composition filter ("entities with no metrics binding")
  plus per-element override.
- **"Discovery" is renamed "Composition"** — it was never just discovery
  scheduling; it's the whole human-curation surface over the resolved graph.
  Sectioning the element detail absorbs the bloat.

Why this belongs in a *data-model* doc: the tabs map 1:1 to the model layers —
**Sources ↔ `topology_data_sources`**, **Composition ↔ the resolved-entity store
(entity + per-entity attachments {access, policy, metrics-binding} + provenance)**,
**Diagram ↔ materialized resolved graph + live values**. The store redesign
(one resolved-entity store, binding emergent) is exactly what makes the IA
collapse to three tabs. Data model and UI converge on the same shape — a sign
the structure is right. (IA implementation is frontend, sequenced *after* the
data model; noted here only to keep model↔UI aligned.)

## Performance basis (access patterns + indexes)

The store is perf-shaped by construction (reads/polls stop re-resolving), but the
schema must declare its access patterns so we don't repeat "indexes fine, model
not perf-shaped":

- **`entity_identity`**: hot path is "given an identity key, find its entity" →
  `UNIQUE(kind, value)` (the lookup *and* the one-key-one-entity invariant).
- **binding** (whether attachment-on-element or a row): looked up per topology
  and per element → index `(topology_id, entity_id)`; resolution cache carries
  `resolved_ref` + `resolved_at` for re-validation.
- **materialized resolved graph**: one artifact per topology, read by id;
  invalidated per topology (ideally per source) on observation/authored change —
  NOT recomputed per poll.
- Writes (resolve reconcile, binding edits) are far rarer than reads/polls, so
  the read-cheap / write-on-change trade is correct.

Note the boundary: this removes the **data-model** perf causes (per-poll
resolve+layout, per-poll binding resolution, O(N×H) match). It does **not** fix
the orchestration/render causes — subscriber-scoped polling, plugin `item.get`
batching, client SVG/layout — which stay in `performance-scaling.md`. "Perf
fully fixed" is false; this is the data-model half.

## Old-path retirement (no dual model)

Each phase must *remove* the path it replaces, or we recreate the dual-model debt
that already exists today (legacy single-source columns
`topologies.topology_source_id`/`metrics_source_id` still read + indexed +
propagated to `/context`; a legacy file-based-topology path `topologyManager` in
`server.ts` still polled alongside DB topologies). Explicit deletions:

- `topologies.mapping_json` → migrate into bindings, then **drop** (no both).
- RAM-only resolve in `TopologyService.cache` → replaced by the materialized
  store (don't keep recomputing as the source of truth).
- The standalone auto-map module / mapping store / Mapping tab → folded into the
  Composition surface and removed.
- Legacy `topology_source_id` / `metrics_source_id` columns + their indexes →
  **drop** (m2m `topology_data_sources` is the model).
- Decide the **file-based topology path** (`topologyManager`): retire or
  explicitly scope it out — don't leave it as a third quiet code path.

## Accepted residuals (unavoidable; not defects)

- **Volatile counter ref (e.g. Zabbix item id) stays a cache.** The binding's
  three layers are: ① binding (identity: ifName/mgmtIp/source — durable, stored,
  the source of truth), ② resolution (identity → concrete counter id — volatile,
  a `resolved_ref` + `resolved_at` cache, re-resolved on miss/age/re-sync), ③
  value (bps/status — fetched per poll, never stored). Item ids are Zabbix-owned
  and change on item recreation, so they must **not** be persisted as truth —
  caching the resolution is the correct layering, not a clean-DB failure.
- **Raw observations stay JSON blobs** (append-only document history) — deliberate.
- **Identity-less elements** (no mgmtIp/ifName) can't be identity-keyed; they
  fall back to a weaker per-source id and need human binding. Hard limit.
- **Port identity (T0) is a prerequisite** for fully identity-based *link*
  bindings; until each source emits ifName/ifIndex (TTDB doesn't yet), link
  binding stays partly LLDP/name-based — a staged state.
- **Migration is best-effort**: existing `mapping_json` re-keys via the current
  resolved graph; bindings whose identity can't be recovered are dropped.
- **Entity merge/split** in the identity registry is the one genuinely hard
  correctness case (a bridging observation merges two entities) — rules + tests,
  not avoidance.

## Relation to other docs
- Supersedes the "separate `mapping_binding` table" of `metrics-mapping-model.md`
  (folded into the attachment + identity-registry model here).
- Builds on the identity / priority-merge / attachment invariants
  (`topology-foundation-identity.md`, `topology-source-priority-merge.md`,
  `topology-node-attachments.md`) and the binding tiers of
  `link-interface-resolution.md` (T0 port identity is the prerequisite).
- The non-DB perf items (subscriber-scoped polling, plugin call batching, client
  layout reuse) live in `performance-scaling.md`; this refactor removes their
  *data-model* causes (per-poll resolve, per-poll binding resolution) but the
  orchestration fixes are separate.
