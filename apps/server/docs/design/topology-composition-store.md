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

## Implementation status (as-built — PR #360)

The data-model migration is **implemented and Codex-LGTM** (PR #360). This plan
below is the reasoning of record; the deltas from it, all deliberate:

- **`mapping_json` fully dropped, no residual** (the plan kept a residual for
  link / unanchorable entries). The operator chose **no-backcompat**: the backfill
  migrates every anchorable entry to a binding, **audits + logs** the rest
  (entries with no metrics source or no node/port identity), then drops the
  column. Link bindings ARE implemented (port attachments), but **require port
  identity** to anchor — name-only sources (e.g. TTDB) can't bind link metrics
  until their plugin stamps `NodePort.identity` (issue #363).
- **Column drop is imperative in the backfill** (after success), not a separate
  SQL migration — the column is created by migration 001, so the data move (TS,
  needs the resolver) must precede the drop within one step.
- **Legacy `topology_source_id` / `metrics_source_id` dropped** (migration 013),
  backfilling them into the m2m `topology_data_sources` first.
- **Manual/authored is already an equal contribution** at resolve (top priority,
  no `authored ===` field-merge casing). The only remaining asymmetry is its
  storage location (`data_sources.config_json.graph` — content in config),
  deferred to issue #361.
- **resolve gained link-endpoint port-id remap** so a port binding folds onto the
  link's endpoint port.

Follow-ups (own PRs): #361 authored-graph store, #362 5→3 tab IA, #363 plugin
port identity, #364 DB integration-test harness. Non-data-model perf
(orchestration / render) stays in `performance-scaling.md` (#354).

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
- the binding is keyed by **identity on both ends** — element identity (node /
  port) ↔ *source-side* identity (host id/name for nodes; **interface identity**
  for ports, NOT an interface name string). A provider-side interface rename must
  not break it, so the link binding stores `interfaceIdentity?: Identity` (ifName/
  ifIndex/mac) with `interfaceName?` kept only as a human label / migration
  fallback. (Codex BLOCKER: storing `interface: string` re-introduces the
  name-fragility we're removing.)

**Who produces bindings (scoped honestly).** Today bindings are **authored /
human** — there is no plugin capability to *emit* a binding as an observation
(`MetricsCapable` only has `pollMetrics`/host+item listing). So:
- **Now (Phase 2):** bindings are human/authored contributions, carried in the
  Manual source's authored graph and folded by resolve. Auto-map becomes a
  server-side job that *writes authored bindings* (origin still `authored`), not
  an emergent observed layer.
- **Later (future capability):** a metrics source could emit binding attachments
  as observations (a new `BindingDiscoveryCapable` or a metrics-source observation
  graph of stub identity nodes/ports), at which point auto-map becomes mostly
  *observed* and the human only overrides. The attachment + priority-merge model
  already accommodates this — it's an additive capability, not a remodel.

Three layers:
- **binding** (element-identity ↔ source/host/port-identity) — the durable field,
  carried by contributions, resolved by identity.
- **resolution** (port identity → concrete counter id, e.g. Zabbix item id) — a
  re-validated **cache** (`resolved_at`-stamped, RAM or column); never the source
  of truth, because item ids are volatile.
- **value** (bps / status) — never stored; fetched per poll.

**The resolution layer must reach the plugin boundary as identity, not a name**
(Codex BLOCKER). Storing `interfaceIdentity` is pointless if the poll then matches
by name. Today the metrics contract is name-based:
`LinkMetricsMapping.interface: string` (`plugin-types.ts:208`),
`HostItem.interfaceName?: string` (`:67`),
`InterfaceNeighbor.localInterface: string` (`:87`), and plugins poll by that name
(Zabbix `plugin.ts:192`, Aruba `plugin.ts:286`, Prometheus `types.ts:54`). So the
contract gains identity on both sides:
- **Plugin exposes** source-side port identity: `HostItem.interfaceIdentity?:
  Identity`, `InterfaceNeighbor.localInterfaceIdentity?: Identity`. (Plugins that
  only know a name set `interfaceName`; the resolver treats name as a weak key —
  the accepted residual for sources without ifIndex/mac.)
- **Poll input is derived, not stored**: the server builds the per-poll
  `LinkMetricsMapping` from `MetricsBindingAttachment.interfaceIdentity` by
  matching against the source's listed `interfaceIdentity` to get the *current*
  name/item id — a transient poll-adapter output, re-derived each cycle (this IS
  the resolution cache). `LinkMetricsMapping.interface` stays a string at the
  plugin call (no plugin rewrite), but it's freshly resolved from identity, so a
  provider-side rename re-resolves instead of breaking.
- **Acceptance:** rename an interface on the metrics source → link metrics keep
  resolving (the stored `interfaceName` is never the match key; identity drives the
  re-resolution).

**One binding per (source, element) — invariant.** `attachmentKey` =
`metrics-binding:${sourceId}` deliberately allows *different* metrics sources to
each bind one element, but assumes a single binding per source per element. If a
future need appears (per-metric-role binding, aggregate/member interfaces),
extend the key to `metrics-binding:${sourceId}:${role}` — do not overload one
slot. State the invariant in code so it's a conscious change later.

### 2. Resolved current graph — materialize, don't recompute-per-poll
Persist the resolver output so reads/polls don't re-resolve + re-layout each
time: store the resolved graph (and layout) per topology as a derived artifact,
recomputed only when an observation/authored edit invalidates it — not on every
metrics poll. Lowest risk; kills the "resolve+layout every cycle" cost; keeps the
NetworkGraph shape.

**Invalidation must be O(1), not a per-poll blob hash.** Do NOT recompute a hash
over observation/authored blobs on every `getParsed()` — that re-introduces
per-poll DB work proportional to topology size (Codex SHOULD-FIX). Instead bump a
cheap **`composition_revision`** integer on the `topologies` row whenever an input
changes (observation recorded, authored edit, source attach/detach/priority). The
materialized artifact stores the revision it was built from; a poll compares two
integers. The artifact key must also fold a **`resolver_version` / `layout_version`**
constant so a resolve/layout algorithm change invalidates stale artifacts without
a manual purge.

**Artifact shape.** `ParsedTopology` today carries graph, `layout`, `resolved`,
`iconDimensions`, `metrics`, `mapping` (`services/topology.ts:85-95`). Persist
the *derived-from-inputs* parts only: `graph_json` (resolved NetworkGraph) +
`layout_json` (the full `computeNetworkLayout()` result: `{resolved, layout}`).
**Metrics are always live** (never stored — they're per-poll values). **Icon
dimensions** stay RAM-derived (a CDN-cached lookup, cheap, not composition
truth); the derived `mapping` is computed from the resolved graph's bindings at
read time (§1), not stored separately.

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
  (axis-2) work — it can land independently.

**Storage in Phases 1–4: subgraphs stay JSON inside the resolved graph.** This
plan does NOT add `container` / `membership` tables (Codex SHOULD-FIX: §4 must not
imply DDL that Phases 1–4 don't deliver). Subgraphs already ride inside the
`NetworkGraph` blob — the materialized artifact (§2) carries them as-is. The
"reserve a slot" requirement is satisfied because the resolved-graph artifact is a
full `NetworkGraph` and the axis-1 nesting fix operates on `resolve.ts`
(`foldSubgraphs` / `namespaceSourceSubgraphs`) + the JSON shape, needing no new
table. Dedicated container/membership tables are part of the deferred Phase 5
normalization (or the axis-1 PR if it ever needs SQL over containers) — not
this sequence.

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
  /**
   * Link binding (lives on the monitored NodePort): the source-side interface
   * IDENTITY, not a name string — a provider-side rename must not break it.
   */
  interfaceIdentity?: Identity   // ifName/ifIndex/mac on the metrics source
  /** Human label / migration fallback only — never the match key. */
  interfaceName?: string
  /** Link bandwidth override (bps). */
  bandwidth?: number
}
export type Attachment = AccessAttachment | PolicyAttachment | MetricsBindingAttachment

// attachmentKey() gains:  'metrics-binding' → `metrics-binding:${a.sourceId}`
//   (one binding slot per metrics source → two metrics sources can both bind;
//    human override replaces a source's slot, suppress removes it. ONE binding
//    per (source, element) is an invariant — extend the key with a role segment
//    if per-metric-role binding is ever needed; don't overload the slot.)

// 2. Ports gain an attachment slot (risk #3). Today only Node/Subgraph/
//    NetworkGraph carry attachments; link bindings live on the port.
export interface NodePort {
  // ...existing fields (already has `identity` + `provenance`)...
  attachments?: Attachment[]
  suppressedAttachments?: string[]
}
```

`resolve.ts` must fold port attachments the same way it folds node attachments.
This is **not free today** (Codex BLOCKER) — wire all four touch points:
- **`foldPortCluster()`** (`resolve.ts:626-653`) currently merges only scalar port
  fields + identity + provenance. Add an attachment fold mirroring
  `foldAttachments()` (`resolve.ts:502`): merge by `attachmentKey`, highest-priority
  contribution wins, honor `suppressedAttachments`, stamp provenance.
- **`NodePort`** gains `attachments` + `suppressedAttachments` (core types above).
- **Suppression allowlist** (`api/discovery-policy.ts:58-66`) is hardcoded to
  `access:*` / `policy` keys — it must accept `metrics-binding:*` keys too, or
  human "remove this binding" can't persist.
- **Authored-overlay rail** (`api/discovery-policy.ts:300-321`) only knows *node*
  overlays and requires *node* identity. A link binding lives on a port, so define
  the **port-only authored shape**: a thin authored node (carrying node identity so
  resolve can cluster it) whose `ports[]` holds the target port (with `id`,
  `label`, `connectors`, **port identity**, and the `metrics-binding` attachment).
  Specify the fallback when port identity is weak/absent (fall back to port label
  match within the identity-matched node; flag as low-confidence).

**No new "where do human edits live" rail**: a human binding override is a
`metrics-binding` attachment on the node/port inside the Manual source's authored
graph — the same place access/policy overrides already persist. Add acceptance
tests for: discovered-only port override, port-binding suppression, and
re-scan-survival of both.

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
Core types above + a **TypeScript backfill** (NOT a pure-SQL migration) + a later
contract migration. Follow expand → backfill → read-new/write-new → drop-old so
the column is never dropped before data is safely moved.

**Why not a `.sql` migration:** the migration runner (`db/schema.ts:115-139`) only
splits SQL on `;` and `db.exec`s it — it cannot call `resolve()`, parse JSON, or
mutate graphs. Re-keying needs the resolver. So the backfill is application code,
not `012_*.sql` (Codex BLOCKER).

- **Core:** add `MetricsBindingAttachment`, `NodePort.attachments` +
  `suppressedAttachments`, `attachmentKey` case; fold port attachments in
  `resolve.ts` (the four touch points listed above).
- **Server reads (write-new path):** `parseTopology` stops reading
  `topology.mappingJson`; instead **derive** `MetricsMapping` from the resolved
  graph by walking `metrics-binding` attachments (replace
  `services/topology.ts:524-531`; new `deriveMappingFromGraph(graph)` helper).
  Also update the direct poll parse in `server.ts` (`~373-406`, incl. the
  `link-${i}` fallback) and the mapping-mutation routes in
  `api/topologies.ts` (`~374-423`). `updateMapping()` writes a binding attachment
  into the authored graph (reuse `discovery-policy.ts` authored-mutation path)
  instead of `mapping_json`.
- **Backfill (one-shot, idempotent, audited):** for each topology with
  `mapping_json`, resolve the current graph, map each entry (node id → node
  identity; link id → the monitored endpoint's *port* identity) and write a
  `metrics-binding` attachment (`provenance.source='authored'`) into the Manual
  authored graph. **This is best-effort and cannot be assumed correct** — the old
  keys are the unstable `discovered:N`, so a mapping that already drifted will
  canonize a wrong host/interface. Emit an **audit artifact** per entry: old key,
  resolved element label, identity quality (strong/weak/none), target host/iface,
  and `unmigrated` reason. Do not silently drop — log every dropped entry.
- **Drop-old (separate, later migration `0xx_drop_mapping_json.sql`):** only after
  the backfill has run and been spot-checked, `ALTER TABLE topologies DROP COLUMN
  mapping_json`. Keep the column readable until then (no dual *write*, but a safe
  rollback window).
- **Poll:** binding carries identity, not item id. Add `interfaceIdentity` to the
  metrics-plugin contract (`HostItem.interfaceIdentity`,
  `InterfaceNeighbor.localInterfaceIdentity` in `plugin-types.ts`); the server
  derives each poll's `LinkMetricsMapping.interface` from the binding's
  `interfaceIdentity` by matching the source's *current* interface list (the
  resolution layer / §1). Resolve port identity → counter id through a
  **re-validated cache** (Phase 2 may keep this in RAM in the plugin/poll loop;
  durable cache table is optional, see residuals). Plugin call signatures don't
  change — only how the name they receive is obtained.
- **Acceptance:** add/remove/reorder a device, re-sync → bindings stay attached
  (no `discovered:N` drift); backfill produces an audit list and migrates every
  *recoverable* entry; metrics still render; after the drop migration no code reads
  `mapping_json`.

### Phase 3 — Materialized resolved graph  · decouple poll from resolve
Migration `0xx_resolved_graph_cache.sql` (number sequentially after Phase 2).
```
-- O(1) invalidation token bumped on any composition input change.
ALTER TABLE topologies ADD COLUMN composition_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE topology_resolved_graph (
  topology_id TEXT PRIMARY KEY REFERENCES topologies(id) ON DELETE CASCADE,
  graph_json   TEXT NOT NULL,    -- resolved NetworkGraph
  layout_json  TEXT,             -- full computeNetworkLayout() result {resolved, layout}
  built_revision INTEGER NOT NULL,  -- topologies.composition_revision this was built from
  resolver_version INTEGER NOT NULL,-- bumped when resolve/layout algorithms change
  computed_at  INTEGER NOT NULL
);
```
- **Invalidation is O(1), not a per-poll hash** (Codex SHOULD-FIX): bump
  `topologies.composition_revision` on every input change — observation recorded
  (`observations.record`), authored edit (`writeManualGraph` /
  `discovery-policy`), source attach/detach/priority (`topology_data_sources`
  writes). A poll compares two integers (`built_revision` vs current +
  `resolver_version` vs the code constant); it never re-reads observation blobs to
  decide freshness.
- **Server:** `getParsed()` reads the artifact; recomputes (resolve + layout)
  **only** on revision/version mismatch — NOT on every metrics poll. The artifact
  replaces the RAM `cache` as source of truth (RAM may stay as an L1 in front of
  it). Metrics stay live; icon dimensions stay RAM-derived (§2).
- **Acceptance:** a metrics poll cycle performs zero `resolveObservations` /
  `computeNetworkLayout` calls when `composition_revision` is unchanged (assert via
  counter/log); editing the authored graph bumps the revision and forces exactly
  one recompute; cold start serves from the table; a `resolver_version` bump
  invalidates all artifacts without a manual purge.

### Phase 4 — Retire old paths  · no dual model
Migration `0xx_drop_legacy_topology_columns.sql` (number sequentially).
> Migration numbers across phases are relative — assign the next free integer at
> implementation time (next free today is `012`; `009` was skipped). Each phase's
> drop is its own migration so it lands after its backfill/read-switch.
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
Tracked separately (§4). Subgraphs ride inside the resolved `NetworkGraph` JSON
(no container/membership tables in this sequence — see §4), so the fix operates on
`resolve.ts` (`foldSubgraphs` / `namespaceSourceSubgraphs`) + the JSON shape and
lands independently of Phases 1–4. No store-schema dependency.

## Risks / open decisions

1. **Entity merge/split** — only arises *if* we do the deferred full
   normalization (persisted stable ids). The shipping attachment model needs no
   persisted registry; resolve re-clusters in memory each run, so the problem
   doesn't exist for it. Flag it for the deferred phase only (rules + tests then).
2. **Migration of existing `mapping_json`** — TS backfill, re-key via the current
   resolved graph (`provenance.source='authored'`). **Best-effort & not
   trust-the-data**: old keys are unstable `discovered:N`, so a drifted mapping
   canonizes a wrong binding — emit a per-entry audit (old key, identity quality,
   target, unmigrated reason); drop the column only in a later migration after the
   backfill is spot-checked. One-shot.
3. **Ports need an attachment slot + fold wiring** — `metrics-binding` for links
   lives on `NodePort`. NOT just a field add: `foldPortCluster` must fold
   attachments, the discovery-policy suppression allowlist must accept
   `metrics-binding:*`, and the authored-overlay rail must support port-level
   overlays (it's node-only today). See the four touch points in §Core type changes.
4. **Materialized vs normalized resolved graph** — start materialized; normalize
   only if SQL queries over nodes/links become needed.
5. **Cache-busting granularity** — today any edit clears the whole parsed cache;
   the materialized store should invalidate per topology, ideally per source.

## Information architecture (tabs follow the model)

Once binding is **a folded attachment on the entity** (not a separate side store /
tab), the topology tab's sub-tabs collapse to match the data model's three layers
— **inputs → resolved composition → output**. (Bindings are authored today; if the
future observed-binding capability lands they become mostly emergent — the IA is
the same either way.)

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
  in an element's detail. Auto-map becomes a server-side job writing authored
  bindings; "auto-map all" dissolves into a Composition filter ("entities with no
  metrics binding") plus per-element override.
- **"Discovery" is renamed "Composition"** — it was never just discovery
  scheduling; it's the whole human-curation surface over the resolved graph.
  Sectioning the element detail absorbs the bloat.

Why this belongs in a *data-model* doc: the tabs map 1:1 to the model layers —
**Sources ↔ `topology_data_sources`**, **Composition ↔ the resolved-entity store
(entity + per-entity attachments {access, policy, metrics-binding} + provenance)**,
**Diagram ↔ materialized resolved graph + live values**. The store redesign
(one resolved-entity store, binding folded onto the entity) is exactly what makes
the IA collapse to three tabs. Data model and UI converge on the same shape — a sign
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
