# DB-native persistence — uniform contributions, document + relations

> Status: DRAFT (2026-06-07, **rewritten to the uniform-contribution model** after
> review found the previous draft was re-introducing a dissolved "authored layer").
> Design of record for the follow-up to PR #375 (#362). No backward compatibility.

## ⚠️ Canonical model — read this first (the root-cause fix)

This single statement is the source of truth. Every past round of confusion came from
re-deriving a privileged "authored / Manual layer" that **does not exist**:

> **There is NO authored layer. There is NO human-vs-machine branch.**
> A topology is **N source contributions**, each tagged by a `source`
> (`data_sources.id` *or the literal* `'human'`). The human edit is **just one
> source** — it differs only by *values*, never by code path:
> - **priority** — the human contribution has the highest priority (it wins per-field).
>   "Human wins" = "highest priority number", not an `if (human)`.
> - **negation** — a *negative assertion* (suppression / exclusion) is a tombstone
>   contribution; today only `'human'` emits them, but that's usage, not a special case.
> - **provenance** — `source` is a label the UI reads to mark a value editable; it is
>   not a layer.
>
> `resolve()` clusters all contributions by identity and merges by priority. Storage,
> merge, and API treat `'human'` **identically** to any data source. **Do not add a
> special table, code path, or vocabulary for "authored" / "Manual".** This was
> settled by #335 (Git-like priority merge) and #370 (Manual is a uniform source);
> this document finishes the job in storage.

If a future change tempts you to special-case the human/Manual contribution — stop.
That is the recurring bug.

## Thesis

Two "types" were conflated:

1. **`@shumoku/core`'s `NetworkGraph`** — the library's interchange/serialization format
   (parser output, renderer input, every export). JSON-shaped, correctly so. **Stays.**
2. **The server's persistence model** — it was just (1) pickled as a blob; three
   refactors only *moved* the blob (`content_json` → `config_json.graph` →
   `topology_observations.graph_json`), never cutting the **"core type == storage
   model"** coupling. Worse, each move kept the *Manual = special* framing alive, so the
   metrics mapping stayed un-queryable and the "authored layer" kept being re-derived.

> **North star.** The **DB is canonical**. `NetworkGraph` (JSON) is a **lossless
> projection**: export = project the DB to a graph; import = decompose a graph into
> contribution rows. The human contribution round-trips like any source's.

## Architecture: uniform per-source contributions (document + relations)

Every source — external *and* `'human'` — stores the **same shape**:

- **`contribution_element`** rows (node / port / subgraph / **termination**), each with a
  `payload_json` document column for the un-queried payload (label, spec/equipment,
  icon, style, position, intra-source structural detail like pins/direction/via/bends).
- **`contribution_identity`** rows — the multi-key match keys resolve clusters on.
- **`contribution_link`** rows — edges (endpoints reference the source's own elements).
- **`contribution_attachment`** rows — **the mapping/policy/access** (metrics-binding's
  dependency target is an FK column, not buried in JSON).
- **negations** (suppression / exclusion) — tombstone rows, source-tagged.

`resolve()` reads all contribution rows for a topology, **assembles one input entry per
source** (the same `SnapshotEntry[]` it already consumes), clusters by identity, merges
by priority, and materializes ③ `topology_resolved_graph`. **Merged entities are never
persisted** — clustering stays in-memory at read time, exactly as today, so the
"entity merge/split" problem the composition-store doc deferred (YAGNI) **does not
arise** (that objection was about persisting *merged* entities; we persist *per-source*
contributions).

**This is the document+relations hybrid applied uniformly:** rows + a payload document
column (not over-normalized — spec/style/position stay JSON), with the queryable axes
(identity, attachments, links, the binding's target) as real FK-enforced columns.

### Why uniform (not "human = rows, observed = JSON")

An earlier draft stored the human contribution as relational rows and observed
contributions as JSON snapshots. That re-introduced exactly the human-vs-machine split
#335 dissolved (see Canonical model). The trilemma — *uniformity* vs *queryable O(1)
mapping* vs *don't-normalize-observed* — is resolved by choosing **uniformity +
queryability**: normalize **all** contributions to the rows-plus-payload shape. The cost
is that an external sync writes per-source rows (a transactional replace) instead of one
JSON blob; in return the mapping is queryable, edits are O(1), and there is one code
path for everyone.

## Schema (END STATE)

`source` is `data_sources.id` or the literal `'human'` everywhere. `payload_json` is the
document column (promote a scalar to a generated column only when a query needs it).

```
-- Existing, unchanged
topologies              id, name, share_token, composition_revision, …
data_sources            id, name, type, config_json, status…
topology_data_sources   id, topology_id, data_source_id, purpose, sync_mode, priority,
                        last_synced_at, status, consecutive_failures, last_ok_captured_at…
topology_resolved_graph topology_id, graph_json, layout_json, …, built_revision, resolver_version
                                                            -- ③ materialized stitch (output)
-- NOTE: topology_observations (the per-source JSON snapshot) is RETIRED — its content
-- becomes contribution_* rows. (Or kept only as a raw audit log, decided at migration.)

-- ② Uniform contributions (rows + payload document column)
contribution_element
  id            INTEGER PRIMARY KEY,
  topology_id   TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,                 -- data_source_id | 'human'
  local_id      TEXT NOT NULL,                 -- element id within this source's assertion (round-trips)
  kind          TEXT NOT NULL,                 -- 'node'|'port'|'subgraph'|'termination'
  parent_local_id TEXT,                        -- within the same source
  payload_json  TEXT,                          -- label, spec/equipment, icon, style, position, intra-source detail
  UNIQUE (topology_id, source, local_id)

contribution_identity
  element_id  INTEGER REFERENCES contribution_element(id) ON DELETE CASCADE,
  topology_id TEXT NOT NULL,                   -- denormalized for the cross-source cluster index
  key_type    TEXT, key_value TEXT,
  PRIMARY KEY (element_id, key_type, key_value)  WITHOUT ROWID

contribution_link
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  from_local_id TEXT, to_local_id TEXT,        -- within source (node or port)
  payload_json TEXT                            -- type, arrow, label, via, bends, cable, per-endpoint plug/ip/pin

contribution_attachment
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  element_id INTEGER REFERENCES contribution_element(id) ON DELETE CASCADE,  -- NULL ⇔ scope='topology-default'
  scope TEXT, kind TEXT,                        -- 'access'|'policy'|'metrics-binding'
  attachment_key TEXT,                         -- attachmentKey(): 'access:snmp'|'policy'|'metrics-binding:<sourceId>'
  target_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,  -- metrics-binding dependency target (non-destructive)
  negate INTEGER NOT NULL DEFAULT 0,           -- 1 = suppression (tombstone for this key)
  payload_json TEXT                            -- {community,version}|{mode,intervalMs}|{hostId,interfaceIdentity,interfaceName,bandwidth}

contribution_exclusion                          -- identity-keyed negative assertion (hide a node)
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source TEXT NOT NULL, key_type TEXT, key_value TEXT,
  PRIMARY KEY (topology_id, source, key_type, key_value)  WITHOUT ROWID
```

Design notes (resolving the review findings):
- **No human/machine split** — `source` is the only axis; `'human'` is a value. Priority
  comes from `topology_data_sources.priority` (and `'human'` = top); never an `if`.
- **Identity-anchored, not id-anchored** — the binding/policy on a node is a
  `contribution_attachment` whose `contribution_element` carries the node's `identity`
  rows; resolve clusters it with observed contributions by identity. This honors the
  composition-store invariant "overrides are identity-keyed" — `local_id` is only the
  intra-source handle, never the cross-source key.
- **Terminations have a home** (`kind='termination'`); `link.via` references the source's
  own termination elements.
- **Topology-default** = `element_id NULL`; uniqueness via a partial unique index
  `(topology_id, source, attachment_key) WHERE element_id IS NULL`.
- **Suppression = `negate=1`** attachment row; **exclusion** = `contribution_exclusion`.
  Both are ordinary source-tagged contributions (today emitted by `'human'`).
- **`target_source_id` is non-destructive** — `ON DELETE SET NULL` (and resolve already
  filters bindings to currently-attached sources), matching today's "detach keeps the
  binding dormant, doesn't delete it" semantics. No surprise cascade.
- **Round-trip** — referenceable structure (terminations, pins) are elements/edges;
  opaque routing/presentation (bends, style, position) is `payload_json`. Enumerate the
  exact `NetworkGraph` field → column / `payload_json` / resolve-only mapping in the
  stage-1 PR; the golden test asserts a *normalized* equivalence (canonical key order),
  not byte-identity.

## Projection / ingestion + resolve

```
buildContributions(topologyId): SnapshotEntry[]   -- one entry per source (incl. 'human'),
                                                  -- assembled from contribution_* rows (indexed scans)
resolve(buildContributions(topologyId)) → resolved graph → materialize ③   -- merge UNCHANGED

buildGraph(topologyId): NetworkGraph    -- project the 'human' contribution (export) or the resolved graph
ingestGraph(topologyId, source, graph)  -- decompose a NetworkGraph into that source's contribution rows
                                        -- (one transaction; replace that source's rows; PRAGMA defer_foreign_keys
                                        --  for intra-import forward refs)
```
- **resolve()'s merge is genuinely unchanged** — its *feed* changes from `(authored
  object + observation JSON)` to `buildContributions()` rows. The golden test asserts
  `resolve(buildContributions(x)) ≡ resolve(old readManualGraph+snapshots)`, not just a
  build round-trip. Complexity moves into `buildContributions`/`ingestGraph`.
- **A sync** = `ingestGraph(topology, <data_source_id>, scannedGraph)` (replace that
  source's rows; on a failed scan, leave them — status lives on `topology_data_sources`).
- **A human edit** = write `'human'` contribution rows directly (O(1) per binding).
- **No more phantom Manual** — the human contribution is rows tagged `'human'`, owned by
  the topology; nothing auto-creates a "Manual source".

## Staged migration

1. **`contribution_element`/`identity`/`link` + `buildContributions` for the `'human'`
   source** + `ingestGraph`/`buildGraph` + golden round-trip test. Backfill the Manual
   observation's graph into `'human'` rows; drop Manual-as-authored.
2. **`contribution_attachment`** — metrics-binding first (`target_source_id` FK), then
   policy/access; `contribution_exclusion` + `negate` suppression. `reconcileBindings`
   writes `'human'` attachment rows.
3. **Observed sources → contributions.** `syncSource` writes `<data_source_id>`
   contribution rows (replace per source) instead of a `topology_observations` snapshot;
   resolve feeds from rows; retire `topology_observations` (or keep as a raw audit log).
4. **Retire** `manual_source_id`/`findManualSourceId`/`ensureManualSource`; on-demand
   generated columns; optional `product` table. **#375 gap closed; no authored layer left.**
0. **Cleanup (any time):** `DROP TABLE IF EXISTS manual_source_graph, snmp_credentials`
   (dead tables from deleted migrations; present only in long-lived dev DBs).

Backfill is **imperative TS, not SQL** (it needs `resolve()`/`attachmentKey` slotting,
identity keys, audit-don't-drop — like the existing `backfillMetricsBindings`).

## Performance & indexing

- **Read (hot path)** — served from materialized ③ (~19ms / 1475 nodes); ② touched only
  on rebuild. Add a per-topology `authored_revision` (bump on any ② write) stored in ③
  as `built_from_revision` so staleness is a single integer compare.
- **Write** — a binding edit = one `contribution_attachment` UPSERT/DELETE (O(1)).
- **Sync** — per-source transactional row replace; more rows than one blob, but bounded
  and infrequent, and resolve reads rows instead of parsing N blobs.
- **Index every FK column** (SQLite does NOT auto-index FKs; cascade deletes full-scan
  otherwise): `contribution_element(topology_id, source)`, `(parent_local_id)`;
  `contribution_identity(topology_id, key_type, key_value)` (cross-source cluster);
  `contribution_attachment(topology_id, source, element_id)`, `(topology_id, kind)`,
  `(target_source_id)`; `contribution_link(topology_id, source)`, endpoints.
  No redundant prefixes; never index `payload_json`.
- **Avoid N+1** — `buildContributions` fetches each table once per topology.
- **PK strategy** — `INTEGER PRIMARY KEY` for the high-volume contribution tables;
  `WITHOUT ROWID` for the small composite-key ones (`contribution_identity`,
  `contribution_exclusion`) if rows stay <~200 B (verify with `sqlite3_analyzer`);
  TEXT nanoid only for externally-referenced entities (topologies, data_sources).
- **PRAGMAs** shipped in PR #377 (WAL, synchronous=NORMAL, foreign_keys=ON,
  busy_timeout=5000, cache_size=-65536, temp_store=MEMORY, mmap_size=256MiB; optimize on
  close). `defer_foreign_keys` within `ingestGraph` for forward refs.
- **`payload_json`** TEXT by default (SQLite 3.51.1 has JSONB; reserve it + generated
  columns for filtered scalars). Verify hot queries with `EXPLAIN QUERY PLAN`.

## Risks / open questions

- **Sync cost** — observed scans become row-replaces; measure vs the old single-blob
  write before committing stage 3 (the only stage that touches the observed path).
- **`buildContributions` fidelity** — golden test gates it (must equal the old resolve
  feed), since the merge depends on exact contribution shape.
- **No authored history** — replace/upsert keeps current state only; today's append-only
  Manual observations gave latent undo. Acceptable (no UI uses it); the per-source-row
  shape lets an append-only `contribution_event` log be added later without schema change.
- **Editor (apps/editor, IndexedDB) convergence** — standing strategic risk; intended
  end-state: server canonical, editor a `NetworkGraph` round-trip client. Not solved here.
- **Terminology purge** — residual "authored layer" wording in `manual-source-unification.md`,
  `topology-composition-store.md`, and core type comments is the root cause of repeated
  confusion; align them to the Canonical model above as a follow-up.

## References (verified 2026-06)
- Backstage entity-document + relations table + stitching (relations are a regenerated cache; we choose FK-enforced — a deliberate divergence): <https://backstage.io/docs/features/software-catalog/life-of-an-entity/>
- Grafana App Platform — K8s-style resources over SQL unified storage: <https://deepwiki.com/grafana/grafana/3.3-folder-management>
- SQLite JSON/JSONB + generated columns: <https://sqlite.org/json1.html>; FK not auto-indexed: <https://www.sqlite.org/foreignkeys.html>; WITHOUT ROWID: <https://www.sqlite.org/withoutrowid.html>; query planner: <https://www.sqlite.org/queryplanner.html>
- Production PRAGMAs: <https://databaseschool.com/articles/sqlite-recommended-pragmas>; bun:sqlite: <https://bun.com/docs/runtime/sqlite>

## Relationship to existing docs
- `topology-source-priority-merge.md` / #335 — the Canonical model is its storage-side completion.
- `topology-composition-store.md` — its identity-keyed-store intent realized; its observed-normalization YAGNI is respected (we persist per-source contributions, never merged entities).
- `manual-source-unification.md` — #375 known-gap closed; its residual "authored" wording to be purged.
- `topology-ui-ia.md` — unaffected (UI reads the projected graph).
