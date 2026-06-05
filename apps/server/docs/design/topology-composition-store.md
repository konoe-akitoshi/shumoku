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

The keystone is to **make the resolved element id stable**, then hang the
mapping off identity. Everything else is incremental.

### 1. Identity registry — stable cluster ids (the keystone)
Persist `identity-key → stable entity id`. `resolve()` mints ids from this
registry instead of the positional `discovered:N`: for each cluster, look up by
any of its identity keys; reuse the stable id if known, else mint one and
register all its keys.

```
entity(
  id            TEXT PK,     -- stable, opaque (replaces discovered:N)
  first_seen, last_seen INTEGER
)
entity_identity(
  entity_id     TEXT FK,
  kind          TEXT,        -- 'mgmtIp'|'chassisId'|'sysName'|'vendorId'
  value         TEXT,
  UNIQUE(kind, value)        -- one identity key maps to one entity
)
```
- Re-sync, reorder, add/remove no longer shift ids → **mapping follows by
  construction.**
- Handles the entity-resolution edge: when a new observation **bridges** two
  previously-separate entities (a key appears that links them), the registry
  merges their stable ids (re-point `entity_identity`, keep the lower id). This
  is the one genuinely tricky case — call it out, test it.

### 2. Mapping = identity-backed binding (reuse attachments)
Key the mapping by the **stable entity id** (node) and **port identity** (link),
not the positional id or interface name. Model it as a **`metrics-binding`
attachment** on the resolved node/port — the same `Attachment` + fold + provenance
+ `suppressedAttachments` machinery that already survives re-sync — rather than a
parallel `mapping_binding` table (this supersedes that part of
`metrics-mapping-model.md`). Layers stay:
- **binding** (element-identity ↔ source/host/port-identity): authored attachment
  + (optionally) observed attachments a metrics source contributes → auto-map
  becomes mostly observed, human only overrides.
- **resolution** (port identity → concrete counter id): a **cache** (source
  adapter or a `resolved_at`-stamped column), never the source of truth — item
  ids are volatile.
- **value** (bps/status): never stored; fetched per poll.

### 3. Resolved current graph — materialize, don't recompute-per-poll
Persist the resolver output so reads/polls don't re-resolve+re-layout each time.
Two options; pick by appetite:
- **3a (recommended first): materialized snapshot.** Store the resolved graph
  (and its layout) per topology as a derived artifact, recomputed only when an
  observation/authored edit invalidates it — not on every metrics poll. Lowest
  risk; kills the "resolve+layout every cycle" cost; keeps NetworkGraph shape.
- **3b (later, if query need appears): full normalization** into
  `entity`/`entity_port`/`entity_link` tables. Enables SQL queries over the
  graph. Higher churn (re-sync = upsert/diff many rows) — defer until a concrete
  query need justifies it. **Not now (YAGNI).**

### 4. Keep as-is (do NOT over-normalize)
- **Raw observations** = JSON blobs (append-only document history). Correct.
- **Plugin `config_json`, `options_json`, `labels_json`** = heterogeneous small
  blobs. Fine.
- Authored graph: move it **out of `config_json.graph`** into its own store
  (it's content, not config) — but still a graph document, not normalized.

### Boundary
The API keeps emitting `NetworkGraph` / `TopologyContext` JSON, generated from
the store. JSON is the wire/render format; the DB is the internal truth.

## Phasing (each independently shippable; schema-lock-aware)

1. **Identity registry + stable ids** (keystone). New `entity`/`entity_identity`
   tables; `resolve()` uses them. Migrate existing mappings by re-keying current
   `discovered:N` → stable id via the resolved graph at migration time. *Lock the
   identity-key schema carefully here — it's the hardest to change later.*
2. **Mapping → `metrics-binding` attachment, keyed by stable id / port identity.**
   Migrate `mapping_json` into attachments on the authored graph. Drop per-poll
   name resolution (read the bound port identity; resolve→item-id cached).
3. **Materialized resolved graph (3a)** + decouple metrics poll from resolve.
4. **Authored graph out of `config_json`** into its own store; drop legacy
   `topologies.topology_source_id` / `metrics_source_id` columns.
5. *(Deferred)* full graph normalization (3b) — only on demonstrated need.

Port identity on elements (T0 from `link-interface-resolution.md`) is a
prerequisite for step 2's link bindings; sequence it before/with step 2.

## Risks / open decisions

1. **Entity merge/split** in the identity registry (bridging observation merges
   two entities; a removed key splits one). The one hard correctness case —
   needs explicit rules + tests. Likely: never auto-split; merge by lowest id;
   record merges.
2. **Migration of existing `mapping_json`** — re-key via current resolved graph
   at migrate time (origin='human', since operator-confirmed). One-shot.
3. **Attachment vs table for binding** — chosen *attachment* for consistency
   (reuses fold/suppress/provenance). Confirm links fit as port attachments
   (ports need an attachment slot — small core change).
4. **Materialized vs normalized resolved graph** — start materialized (3a);
   normalize (3b) only if SQL queries over nodes/links become needed.
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
