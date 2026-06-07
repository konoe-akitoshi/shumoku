# DB-native persistence — uniform contributions, one assertion bucket

> Status: DRAFT (2026-06-07, converged after multiple adversarial reviews + user
> steer). Design of record for the follow-up to PR #375 (#362). No backward compat.

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

-- ② Per-topology contribution registry. One row per contribution. data_source_id set =
--    external feed; data_source_id NULL = the project's own (intrinsic) contribution
--    (written by the editor, never re-fetched). The intrinsic row is NOT a data_source and
--    NOT in the Sources UI, so "phantom Manual" does not return. No 'human'/'authored' tag.
contribution_source
  topology_id    TEXT REFERENCES topologies(id) ON DELETE CASCADE,
  source_id      TEXT,                           -- this contribution's id (ordinary id)
  data_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,  -- NULL ⇔ the project's own contribution
  priority       INTEGER,                        -- merge precedence; the intrinsic contribution = MAX
  graph_payload_json TEXT,                       -- this contribution's graph-level fields: settings, pins, version, name
  PRIMARY KEY (topology_id, source_id)

-- ② Contributions (rows + payload doc column), uniform for every contribution (external + intrinsic)
contribution_element
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  local_id    TEXT NOT NULL,                     -- element id WITHIN this source (round-trips); never the cross-source key
  kind        TEXT NOT NULL,                     -- 'node'|'port'|'subgraph'|'termination'
  parent_local_id TEXT,
  negate      INTEGER NOT NULL DEFAULT 0,        -- 0 = present (scoop), 1 = hide (identity-only row)
  payload_json TEXT,
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  UNIQUE (topology_id, source_id, local_id)

contribution_identity
  element_id INTEGER REFERENCES contribution_element(id) ON DELETE CASCADE,
  topology_id TEXT NOT NULL,                     -- denormalized for the cross-source cluster index
  key_type TEXT, key_value TEXT,
  PRIMARY KEY (element_id, key_type, key_value)  WITHOUT ROWID

contribution_link
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  from_local_id TEXT, to_local_id TEXT,
  negate INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT,
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE

contribution_attachment
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL, source_id TEXT NOT NULL,
  element_id INTEGER REFERENCES contribution_element(id) ON DELETE CASCADE,  -- NULL ⇔ scope='topology-default'
  scope TEXT, kind TEXT,                         -- 'access'|'policy'|'metrics-binding'
  attachment_key TEXT,                           -- attachmentKey(): 'access:snmp'|'policy'|'metrics-binding:<sourceId>'
  target_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,  -- metrics-binding target (non-destructive)
  negate INTEGER NOT NULL DEFAULT 0,             -- 0 = assert, 1 = suppress
  payload_json TEXT,
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE
```
Notes:
- **One assertion bucket**: scoop/hide are `contribution_element.negate`; assert/suppress
  are `contribution_attachment.negate`. No separate `exclusion`/`suppressedAttachments`
  side-channel, no authored-only privilege. (Replaces the old `authored.exclusions`
  array + `suppressedAttachments`.)
- **Identity-anchored** (settles the composition-store invariant-6 contradiction):
  `local_id` is only the intra-source handle; cross-source matching is `contribution_identity`.
- **`contribution_source` resolves three prior blockers at once**: priority lives here (a
  value; the intrinsic `data_source_id IS NULL` row = MAX); FK integrity (every contribution
  FKs a real registry row); retraction is derivable (`data_source_id IS NULL` → never
  re-fetched → persists; otherwise replaced per sync). Graph-level `settings`/`pins` live in
  `graph_payload_json` (closes that round-trip gap). No `'human'`/`'authored'` literal anywhere.
- **Terminations** = `kind='termination'`; `link.via` references the source's own terminations.
- **Topology-default** = `attachment.element_id NULL`; partial unique index
  `(topology_id, source_id, attachment_key) WHERE element_id IS NULL` + the symmetric
  `WHERE element_id IS NOT NULL` for one-slot-per-key.

## Resolve / projection / ingestion

```
buildContributions(topologyId): per-source inputs   -- assembled from contribution_* rows (indexed scans)
resolve(buildContributions(topologyId)) → resolved graph → materialize ③
  · cluster elements by identity
  · presence: per cluster, the highest-priority element's `negate` decides (0 present / 1 hidden)
  · fields & attachments: per key, the highest-priority assertion's sign + payload wins
buildGraph(topologyId, source_id): NetworkGraph     -- project ONE source's contribution (export/edit; raw ids)
exportResolved(topologyId): NetworkGraph            -- project the materialized resolved graph (final picture)
ingestGraph(topologyId, source_id, graph)           -- decompose a graph into that source's rows; ONE txn;
                                                    --   PRAGMA defer_foreign_keys for intra-import forward refs
```
- **resolve's clustering + priority field-merge stay; its presence/suppression unify into
  the signed-assertion model and the `'authored'` literal special-cases are removed.** So
  it is *not* "unchanged" — be honest — but the change is a simplification (one rule:
  top-priority-sign), not a new merge. Golden test: `resolve(buildContributions(x))`
  matches the old `resolve(readManual + snapshots)` for representative graphs.
- **A sync** = `ingestGraph(topology, <data_source_id>, scannedGraph)` (replace that
  source's rows transactionally; on a failed scan, leave them — status on `topology_data_sources`).
- **An editor edit** = write the project's-own contribution (the `data_source_id IS NULL`
  row) incrementally (one attachment/element row = O(1)); never a full-replace, so a crash
  can't wipe it. Import (`ingestGraph` of the whole project graph) is the only full-replace
  and is one transaction.
- **No phantom Manual** — the project's own data is rows under the intrinsic
  `contribution_source` row (`data_source_id IS NULL`), never a user-facing data source.

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
