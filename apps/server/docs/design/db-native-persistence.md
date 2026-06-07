# DB-native persistence — uniform contributions, one assertion bucket

> Status: ADOPTED (2026-06-07, converged after multiple adversarial reviews incl. Codex
> macro + per-stage reviews, + user steer). Design of record for the follow-up to PR
> #375 (#362). No backward compat.
>
> **Shipped:** stage 0 (drop dead tables, #379) · stage 1 (contribution store + codec +
> DB-native authored/intrinsic layer, #378) · the no-phantom-Manual edit paths (#380) ·
> **stage 3 (observed sources read DB-native from the contribution store, #381)**. Stage 3
> kept `topology_observations` as the append-only audit/history log (the "or keep as raw
> audit log" option sanctioned below) — the resolver reads the `contribution_*` rows;
> `ObservationsService.record()` materializes each observed graph into a contribution in
> one transaction. **Remaining:** stage 2b (drop the `resolve.ts` `'authored'` lib-internal
> literal — low value; storage is already clean) and stage 4 (retire
> `manual_source_id`/`ensureManualSource` — blocked on the editor relocation into the
> topology context, #362).

## ⚠️ Canonical model — read first

> **There is no "human" or "authored" concept at all — not a layer, not a label, not an
> `origin` flag.** A topology is **N contributions**, each a `contribution_source` row with
> a `priority`. The ONLY structural distinction is **external vs the project's own**:
> - a contribution **backed by a `data_source`** (`data_source_id` set) is an *external
>   feed* — re-fetched on sync, so a re-sync that omits a node retracts it;
> - a contribution with **`data_source_id IS NULL`** is the **project's own assertions** —
>   written by the editor, never re-fetched, so it persists.
>
> This is **ownership / lifecycle (intrinsic vs external), NOT human-vs-machine** — a
> future automated writer of project-owned data is also `data_source_id NULL`. "The
> project's edits win" = its row holds the top `priority` (a *value*), never `if`. **The
> merge branches on nothing but `priority`.** Editing writes the project's own
> contribution (the topology's intrinsic layer, always available) — **it never spawns a
> source**. Both the `'authored'` literal (~15 `=== 'authored'` sites in `resolve.ts`) and
> any `'human'` tag are **removed**; retraction is derivable from `data_source_id IS NULL`.
>
> **Presence (scoop) and hide are the same bucket**: every contribution asserts
> elements with a **sign** — a normal element row = "this node is here" (scoop); an
> identity-only element row with `negate=1` = "hide this node". Same for attachments:
> `negate=0` asserts, `negate=1` suppresses. `resolve()` clusters by identity and, per
> identity/key, the **highest-priority assertion's sign** decides presence/value. Any
> source can hide in principle; today only the project's own (intrinsic) contribution does — usage, not a rule.
>
> The literal `'authored'` special-cases in `resolve.ts` (~15 sites) are **residue to
> remove**, replaced by priority + the signed-assertion model. Do NOT re-introduce a
> special table, code path, or vocabulary for "authored"/"Manual". (Settled by #335 +
> #370; this doc finishes it in storage.)

## Thesis

Two "types" were conflated: (1) `@shumoku/core`'s `NetworkGraph` — the interchange/
serialization format (parser/renderer/export), JSON-shaped, **stays**; (2) the server's
*persistence* model — which was just (1) pickled as a blob, moved three times
(`content_json` → `config_json.graph` → `topology_observations.graph_json`) without
cutting the "core type == storage model" coupling.

> **North star.** The **DB is canonical**; `NetworkGraph` (JSON) is a lossless
> projection (export = project; import = decompose). **We go DB-native precisely to
> unlock the scaling/tuning a JSON blob structurally cannot do** — index into it,
> partially update it, query it — rather than parsing the whole blob every time. The
> write cost of normalizing scans is *managed by DB design* (indexes, per-source
> incremental replace, generated columns), not avoided by retreating to JSON.

## Architecture: uniform contributions + one signed-assertion bucket

Every contribution — external feeds *and* the project's own — stores the **same shape**:
- a **`contribution_source`** registry row (priority, write-mode, graph-level payload);
- **`contribution_element`** rows (node|port|subgraph|termination + `payload_json`),
  each with a **`negate`** sign (0 = present/scoop, 1 = hide; a hide row is identity-only);
- **`contribution_identity`** rows — the match keys resolve clusters on;
- **`contribution_link`** rows;
- **`contribution_attachment`** rows (access|policy|metrics-binding) with **`negate`**
  (0 = assert, 1 = suppress) and the binding's dependency target as an FK column.

`resolve()` reads all contribution rows, **assembles one input per source**, clusters by
identity, and for each cluster/key takes the **highest-priority assertion's sign** to
decide presence and per-field values; then materializes ③ `topology_resolved_graph`.
**Merged entities are never persisted** — clustering stays in-memory at read time, so the
composition-store "entity merge/split" YAGNI is respected (we persist *per-source*
contributions, never merged ones).

This is the document+relations hybrid applied uniformly: rows + a payload document column
(not over-normalized — spec/style/position stay JSON), with the queryable axes (identity,
attachments, the binding target, the assertion sign) as real FK-enforced columns.

## Schema (END STATE)

A contribution is identified by `contribution_source.id` (an ordinary id). It is an
external feed when its `data_source_id` is set, or the project's own when
`data_source_id IS NULL` — that NULL is the only discriminator, and **no code branches on
any source string literal**. `payload_json` is the document column (promote a scalar to a
generated column only when a query needs it).

```
-- Existing, unchanged
topologies              id, name, share_token, composition_revision, …
data_sources            id, name, type, config_json, status…           -- USER-FACING source catalog
topology_data_sources   id, topology_id, data_source_id, purpose, sync_mode, priority, …  -- user-facing attach config
topology_resolved_graph topology_id, graph_json, layout_json, …, built_revision, resolver_version  -- ③ output
-- topology_observations: RETIRED (its content becomes contribution_* rows; keep only as a raw audit log if desired)

-- ② Per-topology contribution registry. One row per contribution. attachment_id set =
--    external feed (owned by its topology_data_sources attach row); attachment_id NULL =
--    the project's own (intrinsic) contribution (editor-written, never re-fetched). The
--    intrinsic row is NOT a data_source and NOT in the Sources UI, so "phantom Manual"
--    does not return. No 'human'/'authored' tag.
contribution_source
  topology_id   TEXT REFERENCES topologies(id) ON DELETE CASCADE,
  source_id     TEXT,                            -- this contribution's id (ordinary id)
  attachment_id TEXT,                            -- the attach row; NULL ⇔ intrinsic
  last_status   TEXT,                            -- 'ok'|'partial'|'empty'|'failed' (external; drives the replace strategy)
  last_ok_at    INTEGER,
  graph_payload_json TEXT,                       -- graph-level fields: version, name, description, settings, pins
  PRIMARY KEY (topology_id, source_id),
  -- Composite FK ties the attach row to THIS topology (can't reference another topology's attach):
  FOREIGN KEY (attachment_id, topology_id) REFERENCES topology_data_sources(id, topology_id) ON DELETE CASCADE
  -- + attach row must be purpose='topology' (ingest/CHECK); one contribution per attach:
  --   CREATE UNIQUE INDEX one_per_attach ON contribution_source(attachment_id) WHERE attachment_id IS NOT NULL;
  --   CREATE UNIQUE INDEX one_intrinsic  ON contribution_source(topology_id)   WHERE attachment_id IS NULL;
  -- priority has ONE source of truth: external = the attach row's topology_data_sources.priority;
  --   intrinsic (attachment_id IS NULL) = MAX. Detach (delete of the attach row) cascades the contribution.
  -- (requires a UNIQUE(id, topology_id) candidate key on topology_data_sources for the composite FK)

-- ② Contributions (rows + payload doc column), uniform for every contribution (external + intrinsic)
contribution_element
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  local_id    TEXT NOT NULL,                     -- id WITHIN this source (round-trips); never the cross-source key
  kind        TEXT NOT NULL CHECK (kind IN ('node','port','subgraph','termination')),
  parent_local_id TEXT,                          -- same-source parent (port→node, node→subgraph, nested subgraph)
  presence    TEXT CHECK (presence IN ('present','hide')),  -- TRI-STATE: NULL = no opinion (pure identity/attachment anchor) | 'present' = scoop | 'hide'
  payload_json TEXT,
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  FOREIGN KEY (topology_id, source_id, parent_local_id) REFERENCES contribution_element(topology_id, source_id, local_id),
  UNIQUE (topology_id, source_id, local_id),
  UNIQUE (id, topology_id, source_id)            -- candidate key for composite child FKs (same-source guarantee)

contribution_identity
  element_id  INTEGER, topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  key_type TEXT, key_value TEXT,                 -- key_value NORMALIZED at ingest (e.g. lowercased MAC)
  PRIMARY KEY (element_id, key_type, key_value)  WITHOUT ROWID,
  FOREIGN KEY (element_id, topology_id, source_id) REFERENCES contribution_element(id, topology_id, source_id) ON DELETE CASCADE

contribution_link
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  local_id    TEXT NOT NULL,                      -- the source-local Link.id (round-trips)
  from_node_local_id TEXT NOT NULL, from_port_local_id TEXT,   -- endpoint = node (+ optional port), same-source elements
  to_node_local_id   TEXT NOT NULL, to_port_local_id   TEXT,
  presence    TEXT CHECK (presence IN ('present','hide')),     -- RESERVED — see "link scope" note (links are pass-through today)
  payload_json TEXT,                             -- everything else (type/arrow/label/bends/cable/style/rateBps/vlan/redundancy/metadata/per-endpoint plug/ip/pin)
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  FOREIGN KEY (from_node_local_id, topology_id, source_id) REFERENCES contribution_element(local_id, topology_id, source_id),
  FOREIGN KEY (to_node_local_id,   topology_id, source_id) REFERENCES contribution_element(local_id, topology_id, source_id),
  FOREIGN KEY (from_port_local_id, topology_id, source_id) REFERENCES contribution_element(local_id, topology_id, source_id),
  FOREIGN KEY (to_port_local_id,   topology_id, source_id) REFERENCES contribution_element(local_id, topology_id, source_id),
  UNIQUE (topology_id, source_id, local_id)
  -- (an endpoint port must belong to its endpoint node, and *_node/*_port must reference
  --  kind='node'/'port' rows — enforced at ingest; see "kind/scope integrity")

contribution_link_via                            -- ordered termination transits (Link.via), NORMALIZED (not JSON)
  link_id INTEGER REFERENCES contribution_link(id) ON DELETE CASCADE,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  seq     INTEGER, termination_local_id TEXT NOT NULL,   -- a kind='termination' element in the same source
  PRIMARY KEY (link_id, seq)  WITHOUT ROWID,
  FOREIGN KEY (termination_local_id, topology_id, source_id) REFERENCES contribution_element(local_id, topology_id, source_id)

contribution_attachment
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  element_id  INTEGER,                           -- NULL iff scope='topology-default' (CHECK below)
  scope TEXT NOT NULL CHECK (scope IN ('node','port','subgraph','topology-default')),  -- 'port' added: link metrics bind to a port
  kind  TEXT NOT NULL CHECK (kind IN ('access','policy','metrics-binding')),
  attachment_key TEXT NOT NULL,                  -- generated CENTRALLY by attachmentKey() at ingest (canonical, derived from kind+payload)
  target_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,  -- metrics-binding dependency target (see note)
  negate INTEGER NOT NULL DEFAULT 0,             -- 0 = assert, 1 = suppress
  payload_json TEXT,
  CHECK ((scope = 'topology-default') = (element_id IS NULL)),   -- default ⇔ no element; otherwise element required
  CHECK ((kind = 'metrics-binding' AND negate = 0) <= (target_source_id IS NOT NULL)),  -- a real binding needs a target
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  FOREIGN KEY (element_id, topology_id, source_id) REFERENCES contribution_element(id, topology_id, source_id) ON DELETE CASCADE,
  UNIQUE (topology_id, source_id, element_id, attachment_key)   -- one slot per (source, element, key)
  -- topology-default one-slot: CREATE UNIQUE INDEX ON contribution_attachment(topology_id, source_id, attachment_key) WHERE element_id IS NULL;
  -- (scope must match the referenced element's kind: node→node, port→port, subgraph→subgraph — enforced at ingest)
```
Notes (incorporating the Codex macro review):
- **Tri-state presence (the neutral-anchor fix).** `presence` is NULL / `'present'` / `'hide'`.
  **NULL = no opinion** — a pure identity/attachment anchor (a binding/policy on an
  externally-observed node, with no presence claim). `'present'` = scoop; `'hide'` = curate
  out. This is what lets an attachment FK a real element row **without** pinning presence
  (the bare-overlay footgun). Suppression of an attachment is `contribution_attachment.negate`.
- **Ownership via `topology_data_sources`, not global `data_sources`.** `contribution_source.attachment_id`
  FKs the *attach row* (purpose='topology'), so only attached topology-purpose sources can
  contribute, **priority has a single source of truth** (the attach row), and **detach
  cascades** the contribution. The intrinsic contribution has `attachment_id NULL`.
- **Composite FKs prevent cross-source/cross-topology references.** `(id, topology_id, source_id)`
  candidate key on `contribution_element`; identity/attachment/link-endpoints/`parent_local_id`
  all FK through it, so an attachment can't reference another source's element and
  `identity.topology_id` can't disagree with its element.
- **Links normalized** — four endpoint FKs (`from/to_node` + optional `from/to_port`) and an
  ordered `contribution_link_via` relation (terminations). Only bends/cable/style stay in
  `payload_json`. (A `LinkEndpoint` carries both node and port — both are columns now.)
- **Identity-anchored** (settles the composition-store invariant-6 contradiction): `local_id`
  is only the intra-source handle; cross-source matching is `contribution_identity`, with
  `key_value` normalized at ingest.
- **`target_source_id` (metrics-binding) is the dependency target — a `data_source`.** Kept
  global on purpose: a binding may be configured before, or survive detach of, its metrics
  source — `resolve()` honors a binding only while a **metrics-purpose** attach row for that
  source exists on the topology (dormant-but-restorable, matching today's `buildMapping`
  filter). `ON DELETE CASCADE` only fires when the `data_source` is *deleted entirely*
  (then the binding is meaningless). Detach (removing the metrics attach row) does NOT delete it.
- **Discriminator drift guarded** — `kind`/`scope` have CHECKs; `attachment_key` is generated
  centrally by `attachmentKey()` at ingest (the columns are canonical, payload is detail).
- **Hierarchy single-truth**: `parent_local_id` is the ONLY stored hierarchy; `Subgraph.children[]`
  is *derived* on projection, never stored (no double authority). Pins are validated refs
  within the source's graph payload.

## Resolve / projection / ingestion

```
buildContributions(topologyId): per-source inputs   -- assembled from contribution_* rows (indexed scans)
resolve(buildContributions(topologyId)) → resolved graph → materialize ③
  · cluster elements by identity (nodes/ports only — see "kind scope")
  · presence: the PRECISE rule below (NOT "highest row wins")
  · fields & attachments: per key, the highest-priority assertion's sign + payload wins
buildGraph(topologyId, source_id): NetworkGraph     -- project ONE source's contribution (export/edit; raw ids)
exportResolved(topologyId): NetworkGraph            -- project the materialized resolved graph (final picture)
ingestGraph(topologyId, source_id, graph)           -- decompose a graph into that source's rows; ONE txn;
                                                    --   PRAGMA defer_foreign_keys for intra-import forward refs
```

**Presence rule (precise — pin this; the golden test alone won't).** Presence is over the
tri-state `contribution_element.presence` (`'present'` / `'hide'` / NULL = no opinion). A
cluster is **present iff** at least one contribution has a `presence='present'` row for it
**and** the highest-priority *opinionated* row (`'present'` or `'hide'`) is **not** `'hide'`.
A `presence IS NULL` row is a pure **anchor** (it carries identity / attachments but makes
**no** presence claim), and a contribution with **no row** for a cluster expresses no
opinion — so this preserves today's union semantics (a node any source carries is present)
while `'hide'` removes by priority. An attachment-on-an-observed-node is exactly a
`presence IS NULL` anchor → it never pins presence (the bare-overlay footgun is structurally
impossible now, not just discouraged).

**Kind scope.** Identity-clustering + signed presence apply to **nodes and their ports
only**. `subgraph`, `termination`, **and links** are **pass-through per source** today
(resolve has no cross-source identity for them — subgraph ids are namespaced per source,
links are passed through by endpoint remap, `resolve.ts:814`). So `presence` on a
subgraph / termination / **link** is **reserved, not yet resolved** — do NOT implement
their hide until resolve gains an identity for them (for links: a key derived from
resolved endpoint identities, tracked as a separate clustering PR). The "signed presence"
claim is for the kinds the merge actually clusters (nodes/ports).

**Design vs implementation boundary.** This doc fixes the *model* + the *invariants*
(presence tri-state, ownership-via-attach, composite-FK same-source rule, scope↔kind
match, no-cycle hierarchy, lossless-by-construction codec, priority direction + tie-break).
The *executable* form — exact `CHECK`/`FOREIGN KEY`/trigger DDL, cycle-rejection, pin-ref
validation, and the interface-generated round-trip fixtures — is the **stage-1
implementation deliverable**, where it is actually *tested* (golden round-trip + DB tests).
A design doc is not a full DDL; the constraints are proven in code, not prose.

- **resolve's clustering + priority field-merge stay; its presence/suppression unify into
  the signed-assertion model and the `'authored'` literal special-cases are removed.** So
  it is *not* "unchanged" — be honest — but the change is a simplification, not a new
  merge. Note suppression-by-any-priority (`attachment.negate`) is a *new* capability
  resolve must honor (today suppression is authored-only) — part of this rewrite, not free.
  Golden test: `resolve(buildContributions(x))` matches the old
  `resolve(readManual + snapshots)` for representative graphs.
- **A sync's replace strategy is status-driven** (preserves today's `ok`/`partial`/`empty`/
  `failed` retraction semantics, which `topology_observations` carried per-snapshot and
  must NOT be lost — store last status + last_ok_at on the source registry):
  - `ok` → **full replace** of that source's rows (a node missing from the scan is
    retracted — delete-then-insert);
  - `partial`/`empty` → **upsert only** (the scan is incomplete; a missing node is NOT
    authoritative, so don't delete — absence ≠ retraction);
  - `failed` → **no write** (keep the prior rows untouched).
  A boolean "did it succeed" is insufficient — these three behaviors need the status.
- **An editor edit** = write the project's-own contribution (the `data_source_id IS NULL`
  row) incrementally (one attachment/element row = O(1)); never a full-replace, so a crash
  can't wipe it. Import (`ingestGraph` of the whole project graph) is the only full-replace
  and is one transaction.
- **No phantom Manual** — the project's own data is rows under the intrinsic
  `contribution_source` row (`data_source_id IS NULL`), never a user-facing data source.

## Round-trip codec (lossless `NetworkGraph` ↔ rows)

`ingestGraph(buildGraph(g)) == g` is the contract; it needs a field-by-field codec, not
prose. Each `NetworkGraph` / `Node` / `Link` / `Subgraph` field is assigned exactly one
home — a **column**, a **payload_json** key, or **derived/resolve-only** (never stored):

| Surface | → columns | → `payload_json` | derived / resolve-only |
| --- | --- | --- | --- |
| `NetworkGraph` | (per-source) | `version,name,description,settings,pins` in `contribution_source.graph_payload_json` | `nodes/links/subgraphs/terminations` (= rows); `exclusions` (= `presence='hide'` rows) |
| `Node` | `id`(=local_id), `parent`(=parent_local_id), `kind` | `label,shape,rank,style,position,metadata,spec,productId,ports*` | `provenance,fieldSources` (resolve output) |
| `NodePort` | `id,parent` | `label,role,connector,speed,faceplate,aliases,connectors` | folded port id (resolve) |
| `Link` | `id`, four endpoints, `via`(=link_via rows) | `type,arrow,label,bends,cable,style`, per-endpoint `plug/ip/pin` | remapped endpoints (resolve) |
| `Subgraph` | `id,parent` | `label,direction,style,spec,file,pins` | `children[]` (derived from parent edges) |
| `Attachment` | `kind,scope,attachment_key,target_source_id,negate` | kind leaves (`community/version`,`mode/intervalMs`,`hostId/interfaceIdentity/…`) | `provenance` (resolve) |

**Lossless by construction.** `payload_json` is the **catch-all for every field not promoted
to a column** — store `(node minus the promoted columns)` and, on read, overlay columns
back onto payload. So nothing can be silently dropped (Node.size/termination, the full
NodePort surface, Link.rateBps/vlan/redundancy/metadata, every Termination field, etc. ride
in payload automatically); the column list is an *optimization* for query, not the
completeness boundary. The codec table above just records which fields are *promoted*.

Rules: **empty vs absent is preserved** (a stored `''`/`[]` is distinct from a missing
key). Golden fixtures are **generated from the core interfaces** (not hand-listed) so a new
field is covered by construction; cover empty-vs-absent and a full real graph. The test
asserts a **normalized equality** (canonical key order), and additionally
`resolve(buildContributions(x)) ≡ resolve(old readManual + snapshots)`.

## Priority (one direction, derived, deterministic)

- **One direction: higher wins** (matches `resolve()`'s `+Infinity` for the project layer
  and its descending sort). `database.md`'s "lower number = higher precedence" wording is
  **wrong** and must be corrected; migrate existing `topology_data_sources.priority` values
  to the higher-wins convention explicitly.
- **Single source of truth**: external priority = the attach row's `topology_data_sources.priority`
  (not duplicated on `contribution_source`); the intrinsic contribution = MAX.
- **Deterministic tie-break** for equal priority: `source_id` ascending — stable, unique
  per contribution, no stored revision needed; never rely on row insertion order. (Today
  `resolve()` ties on `capturedAt` then nothing — make the final key `source_id`.)

## Scaling (why DB-native, not a blob)

Normalizing scans is the *point*, not a cost to dodge — it unlocks what a JSON blob
cannot:
- **Partial update** — edit one binding = one row (O(1)), vs rewrite the whole blob.
- **Query** — "bindings for source X", "what depends on host H", "disabled nodes" = indexed
  SQL, vs parse-and-walk every blob.
- **Incremental / scoped reads** — resolve reads only the rows it needs; future per-subgraph
  or per-source partial resolve becomes possible.
The per-source row-replace on sync (e.g. ~tens of thousands of rows for a 1475-node scan)
is a transactional write at the 5-minute cadence — measure it, then tune with the index
plan below, WAL, and batched transactions. It is bounded and infrequent, not a wall.

## Performance & indexing

- **Read (hot path)** — served from materialized ③ (~19ms/1475 nodes); ② touched only on
  rebuild. Add per-topology `authored_revision` (bump on any ② write) stored in ③ as
  `built_from_revision` → staleness is one integer compare (also the optimistic-concurrency hook).
- **Index every FK** (SQLite does NOT auto-index FKs; cascades full-scan otherwise):
  `contribution_element(topology_id, source_id)`, `(parent_local_id)`;
  `contribution_identity(topology_id, key_type, key_value)` (cross-source cluster);
  `contribution_attachment(topology_id, source_id, element_id)`, `(topology_id, kind)`,
  `(target_source_id)`; `contribution_link(topology_id, source_id)`, endpoints. No
  redundant prefixes; never index `payload_json`.
- **Avoid N+1** — `buildContributions` fetches each table once per topology.
- **PK strategy** — `INTEGER PRIMARY KEY` for high-volume tables; `WITHOUT ROWID` for the
  small composite-key `contribution_identity` if rows stay <~200 B (verify with
  `sqlite3_analyzer`; long `key_value` like a full chassis string can blow the threshold);
  TEXT nanoid only for externally-referenced entities (topologies, data_sources).
- **PRAGMAs** shipped in PR #377 (WAL, synchronous=NORMAL, foreign_keys=ON,
  busy_timeout=5000, cache_size=-65536, temp_store=MEMORY, mmap_size=256MiB; optimize on
  close). `defer_foreign_keys` inside `ingestGraph`.
- **`payload_json`** TEXT by default (SQLite 3.51.1 has JSONB; reserve it + generated
  columns for filtered scalars). Verify hot queries with `EXPLAIN QUERY PLAN` (no `SCAN TABLE`).

## Staged migration

1. **`contribution_source` + `contribution_element`/`identity`/`link` + `buildContributions`
   for the intrinsic contribution** + `ingestGraph`/`buildGraph` + golden round-trip test.
   Backfill the Manual observation graph into the intrinsic (`data_source_id IS NULL`) rows.
2. **`contribution_attachment` (with `negate`)** — metrics-binding first
   (`target_source_id` FK), then policy/access; unify hide via `contribution_element.negate`.
   Remove the `'authored'` literal special-cases + the `exclusions`/`suppressedAttachments`
   side-channels in `resolve.ts`.
3. **Observed sources → contributions.** `syncSource` writes `<data_source_id>` rows
   (per-source replace) instead of a `topology_observations` snapshot; resolve feeds from
   rows; retire `topology_observations` (or keep as raw audit log).
4. **Retire** `manual_source_id`/`findManualSourceId`/`ensureManualSource`; on-demand
   generated columns; optional `product` table. **#375 gap closed; no authored layer left.**
0. **Cleanup (any time):** `DROP TABLE IF EXISTS manual_source_graph, snmp_credentials`.

Backfill is **imperative TS, not SQL** (needs `resolve()`/`attachmentKey` slotting,
identity keys, audit-don't-drop — like the existing `backfillMetricsBindings`).

## Risks / open questions

- **Sync write cost** — quantify the per-source row-replace at 1475-node scale before
  committing stage 3 (the only stage touching the observed path); tune via indexes/batching.
- **`resolve.ts` rewrite** — removing the `'authored'` literal + unifying negative
  assertions is a real change; the golden test (parity with old resolve output) gates it.
- **`buildContributions` fidelity** — it must reproduce the exact contribution shape the
  merge expects; gated by the golden test.
- **Identity clustering is non-transitive + collision-blind (EXISTING `resolve.ts` limit,
  out of scope here but amplified by signed hide).** A bridge observation carrying keys
  from two clusters joins only the first (no union); weak keys can silently collapse
  unrelated entities. This is the pre-existing algorithm (resolve.ts:217, acknowledged in
  topology-source-priority-merge.md); it should become union-find + collision-surfacing in
  a separate clustering PR before this design's hide-by-priority ships, since a negative
  assertion on a mis-clustered entity is more harmful than a mis-merged field.
- **No authored history** — replace/upsert keeps current state only (today's append-only
  Manual observations gave latent undo). Acceptable; an append-only `contribution_event`
  log can be added later without schema change.
- **Editor (apps/editor, IndexedDB) convergence** — standing strategic risk; intended
  end-state: server canonical, editor a `NetworkGraph` round-trip client. Not solved here.
- **Terminology purge** — residual "authored layer" wording in `manual-source-unification.md`,
  `topology-composition-store.md`, and core comments (`resolve.ts`, `observations.ts`,
  `types.ts`) is the root cause of repeated confusion; align to the Canonical model.

## References (verified 2026-06)
- Backstage entity-document + relations table + stitching (their relations are a regenerated cache; we choose FK-enforced — a deliberate divergence): <https://backstage.io/docs/features/software-catalog/life-of-an-entity/>
- Grafana App Platform — K8s-style resources over SQL unified storage: <https://deepwiki.com/grafana/grafana/3.3-folder-management>
- SQLite: JSON/JSONB + generated columns <https://sqlite.org/json1.html>; FK not auto-indexed <https://www.sqlite.org/foreignkeys.html>; WITHOUT ROWID <https://www.sqlite.org/withoutrowid.html>; query planner <https://www.sqlite.org/queryplanner.html>
- Production PRAGMAs <https://databaseschool.com/articles/sqlite-recommended-pragmas>; bun:sqlite <https://bun.com/docs/runtime/sqlite>

## Relationship to existing docs
- `topology-source-priority-merge.md` / #335 — the Canonical model is its storage-side completion (signed assertions = the symmetric add/override/delete it specified).
- `topology-composition-store.md` — identity-keyed-store intent realized; observed-normalization YAGNI respected (per-source contributions, never merged entities).
- `manual-source-unification.md` — #375 known-gap closed; residual "authored" wording to be purged.
- `topology-ui-ia.md` — unaffected (UI reads the projected graph).
