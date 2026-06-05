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

### Baseline schema (the topology layer as it exists today)
Ground truth for anyone implementing this cold. Migrations live in
`apps/server/api/src/db/migrations/` (embedded via esbuild text loader, listed in
`db/schema.ts`; **next free number is `012`** — note `009` was skipped and is not
tracked). Tables that make up the topology layer:

```
data_sources(id PK, name, type, config_json, status, fail_count, created_at, updated_at)
  -- type='manual' rows hold the authored graph at config_json.graph (migration 011)

topologies(id PK, name,
           topology_source_id → data_sources  [LEGACY single-source pointer],
           metrics_source_id  → data_sources  [LEGACY single-source pointer],
           mapping_json TEXT,                  [the metrics mapping blob — to be retired]
           created_at, updated_at)
  -- content_json was DROPPED in migration 010 (authored graph moved to Manual source)

topology_data_sources(id PK, topology_id → topologies, data_source_id → data_sources,
           purpose 'topology'|'metrics', sync_mode, webhook_secret,
           last_synced_at, priority, consecutive_failures, last_ok_captured_at,
           created_at, updated_at, UNIQUE(topology_id, data_source_id, purpose))
  -- the real m2m source-attachment model

topology_observations(id PK, topology_id → topologies, source_id → data_sources,
           captured_at, status 'ok'|'partial'|'failed'|'empty', status_message,
           graph_json, node_count, link_count, port_count, created_at)
  -- one per source-snapshot; append-only history; retention on write (#357)
```

The resolved graph + layout exist only in `TopologyService.cache` (RAM). The
authored/human layer (including attachment overrides + `suppressedAttachments`)
is **part of the Manual source's `config_json.graph`** — there is no separate
"overrides" table; `discovery-policy.ts` mutates that authored graph. **This is
the rail the metrics-binding human override reuses** (see §1).

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

## Core type changes (the contract the phases build on)

These land in `libs/@shumoku/core/src/models/types.ts` and are the spine of the
whole plan — get them right and the server work is mechanical.

```ts
// 1. New attachment variant — the binding IS an attachment, folded by resolve
//    exactly like access/policy, so it inherits priority-merge + suppression +
//    provenance + re-sync follow for free.
export interface MetricsBindingAttachment extends AttachmentMeta {
  kind: 'metrics-binding'
  /** Which metrics data source supplies values for this element. */
  sourceId: string
  /** Node binding: host identity within that source. */
  hostId?: string
  hostName?: string
  /** Link binding (lives on the monitored NodePort): interface within source. */
  interface?: string
  /** Link bandwidth override (bps). */
  bandwidth?: number
}
export type Attachment = AccessAttachment | PolicyAttachment | MetricsBindingAttachment

// attachmentKey() gains:  'metrics-binding' → `metrics-binding:${a.sourceId}`
//   (one binding slot per metrics source → two metrics sources can both bind;
//    human override replaces a source's slot, suppress removes it)

// 2. Ports gain an attachment slot (risk #3). Today only Node/Subgraph/
//    NetworkGraph carry attachments; link bindings live on the port.
export interface NodePort {
  // ...existing fields (already has `identity` + `provenance`)...
  attachments?: Attachment[]
  suppressedAttachments?: string[]
}
```

`resolve.ts` must fold port attachments the same way it folds node attachments
(`foldNodeCluster`) — by `attachmentKey`, highest-priority contribution wins,
`suppressedAttachments` removes, provenance stamped. **No new "where do human
edits live" rail**: a human binding override is a `metrics-binding` attachment on
the node/port inside the Manual source's authored graph — the same place
access/policy overrides already persist.

## Phasing (each independently shippable; schema-lock-aware)

> Goalpost (don't lose this): **make the topology layer's composition a real
> identity-keyed store** so (a) the metrics mapping follows re-sync by
> construction and (b) reads/polls stop re-resolving+re-laying-out. Everything
> below serves those two. Render and poll-orchestration perf are explicitly NOT
> in scope (see "Performance basis").

### Phase 1 — Port identity (T0)  · prerequisite, no schema change
Sources stamp `NodePort.identity` (ifName strong / ifIndex weak / mac aux) so
link bindings can key on port identity instead of an interface *name* string.
- **Files:** each topology plugin's port emission (`libs/plugins/*/src`), esp.
  Zabbix (`getInterfaceNeighbors` / interface enumeration) and NetBox; the field
  already exists on `NodePort` (`types.ts:218`) — this is *populating* it.
- **Reality check:** TTDB/SNMP sources don't all emit ifName yet → link binding
  stays partly name/LLDP-based until they do (accepted residual). Nodes are
  unaffected (mgmtIp/sysName already stamped).
- **Acceptance:** a re-scan that renames an interface keeps `identity.ifIndex`/
  `mac` stable; resolve clusters the port across scans.

### Phase 2 — Mapping = `metrics-binding` attachment  · THE KEYSTONE
Migration `012_metrics_binding.sql` + core types above.
- **Core:** add `MetricsBindingAttachment`, `NodePort.attachments`,
  `attachmentKey` case; fold port attachments in `resolve.ts`.
- **Migration (`012`):** for each topology with `mapping_json`, re-key each entry
  through the *current resolved graph* (node id → node identity, link id →
  monitored port identity) and write a `metrics-binding` attachment
  (`provenance.source='authored'`) into the Manual source's `config_json.graph`.
  Entries whose identity can't be recovered are dropped (best-effort, logged).
  Then `ALTER TABLE topologies DROP COLUMN mapping_json`.
- **Server:** `parseTopology` stops reading `topology.mappingJson`; instead
  **derive** `MetricsMapping` from the resolved graph by walking
  `metrics-binding` attachments (`services/topology.ts:524-531` deleted; new
  `deriveMappingFromGraph(graph)` helper). `updateMapping()` writes an attachment
  into the authored graph (reuse `discovery-policy.ts` authored-mutation path)
  instead of `mapping_json`.
- **Poll:** binding carries identity, not item id. Per-poll, resolve port
  identity → counter id through a **re-validated cache** (Phase 2 may keep this in
  RAM in the plugin/poll loop; durable cache table is optional, see residuals).
- **Acceptance:** add/remove/reorder a device, re-sync → bindings stay attached
  (no `discovered:N` drift); `mapping_json` column gone; existing mappings survive
  the migration; metrics still render.

### Phase 3 — Materialized resolved graph  · decouple poll from resolve
Migration `013_resolved_graph_cache.sql`.
```
CREATE TABLE topology_resolved_graph (
  topology_id TEXT PRIMARY KEY REFERENCES topologies(id) ON DELETE CASCADE,
  graph_json TEXT NOT NULL,      -- resolved NetworkGraph
  layout_json TEXT,              -- computeNetworkLayout output
  computed_at INTEGER NOT NULL,
  inputs_hash TEXT NOT NULL      -- hash of (observations + authored + priorities)
                                 -- so a stale artifact is detectable
);
```
- **Server:** `getParsed()` reads this artifact; recomputes (resolve + layout)
  **only** when `inputs_hash` changes (observation recorded / authored edit /
  source priority change) — NOT on every metrics poll. Replace the RAM `cache` as
  source of truth; invalidate per-topology on write (residual: per-source
  granularity is a later optimization).
- **Acceptance:** a metrics poll cycle performs zero `resolveObservations` /
  `computeNetworkLayout` calls when inputs are unchanged (assert via counter/log);
  cold start serves from the table.

### Phase 4 — Retire old paths  · no dual model
Migration `014_drop_legacy_topology_columns.sql`.
- Move authored graph **out of `data_sources.config_json.graph`** into its own
  store (it's content, not config) — or explicitly decide to keep it and document
  why. (Lower priority than the drops below; can be its own PR.)
- `ALTER TABLE topologies DROP COLUMN topology_source_id, metrics_source_id`
  (+ their indexes `idx_topologies_topology_source`/`_metrics_source`); purge
  reads in `services/topology.ts`, `api/topologies.ts`, `share*.ts`, `server.ts`.
- Decide the **file-based topology path** (`topologyManager` in `server.ts`):
  retire it or scope it out in writing — don't leave a third quiet code path.
- **Acceptance:** grep shows no remaining reads of the dropped columns; no
  `mapping_json`; the diagram + metrics work end-to-end on the new model alone.

### Phase 5 — *(Deferred, YAGNI)* full normalization + identity registry
`entity` / `entity_identity(kind,value UNIQUE)` / `entity_port` / `entity_link`
tables minting persistent stable ids — only on a demonstrated SQL-over-graph
need. Introduces the entity merge/split problem (risk #1); the Phase 2 attachment
model deliberately avoids it by re-clustering in memory each run.

### Subgraph nesting fix — parallel axis-1 PR (not in this sequence)
Tracked separately (§4). The store schema must already carry **containers +
membership** so the fix has somewhere to live, but the fix itself is axis-1 only
and lands independently of Phases 1–4.

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
