# DB-native persistence — document + relations, the modern hybrid

> Status: DRAFT (2026-06-07, **revised after an adversarial macro review** — see
> § "Why elements are rows"). Design of record for the follow-up to PR #375 (#362).
> Supersedes the storage framing in `topology-composition-store.md` and the known-gap
> in `manual-source-unification.md`. No backward compatibility.

## Thesis

The server conflated two "types":

1. **`@shumoku/core`'s `NetworkGraph`** — the library's interchange / serialization
   format (parser output, renderer input, every export). JSON-shaped, correctly so.
   **Stays untouched.**
2. **The server's persistence model** — what the *application* stores and queries. It
   was just (1) pickled as a blob; three refactors (`content_json` →
   `config_json.graph` → `topology_observations.graph_json`) only *moved* the blob,
   never cutting the **"core type == storage model"** coupling. That debt surfaces as:
   editing the composed graph spawns a phantom Manual source; "Manual is uniform" is
   skin-deep; the metrics mapping can't be queried, indexed, or partially updated.

> **North star.** The **DB is canonical**. `NetworkGraph` (JSON) is a **lossless,
> bidirectional operation surface**: read/export *projects* the DB to a graph;
> write/import *decomposes* a graph into the DB; `JSON → DB → JSON` is identical for
> real data. Nothing is DB-only-inexpressible-in-JSON, nothing is JSON-only-bypassing-DB.

## Chosen architecture: document + relations (the modern hybrid)

How "DB-backed but JSON-operable" tools are actually built (2024–2026) converges on a
hybrid — **not** "fully normalize everything," **not** "one big blob":

- **Storage = rows + a document column.** Backstage stores each catalog *entity* as a
  row with a JSON document, **plus a normalized `relations` table** for the graph edges
  (used for traversal, orphan detection, cascade delete). Edges/keys/identity are
  columns; the rest of the payload is the document.
- **Promote only what you query.** SQLite ≥ 3.45 / Postgres: keep the payload as
  JSON(B), lift queried scalars to **generated columns + indexes** on demand.
- **Resource model + declarative apply + reconcile.** Grafana's App Platform models
  dashboards as K8s-style resources (metadata/spec/status) over SQL storage; processing
  is `spec ⊕ observed → reconcile/stitch → materialized status`.

**The split-canonical rule** (the key line):

> **Skeleton + edges + dependencies + identity = normalized columns (truth, FK-enforced).**
> **The rest of an element's payload (spec/equipment, icon, style, position) = a JSON
> document column on that element's row (truth) + generated columns when queried.**
> Neither "all tables" nor "all blob."

Mapping / dependency data becomes real, FK-enforced rows (queryable, partially
updatable, integrity-checked); equipment/icons/style stay in the per-element document.

## Why elements are rows (not one authored-graph blob) — the load-bearing decision

An earlier draft kept all authored structure in a single `authored_graph.doc_json`
blob and hung the relations off it "by identity." An adversarial review killed that:

- **No referential integrity.** An `attachment`/`identity` row would reference a node
  *inside a JSON blob* — no FK possible, so orphan rows are structural and need a manual
  sweep. The old nested-in-blob model got node↔attachment atomicity for free; a blob +
  side tables *loses* it.
- **No stable anchor.** Identity is multi-key, mutable, and absent on hand-drawn nodes
  (the current code falls back to node-id). "Anchor by identity" can't address an
  identity-less node, and `topology-default` scope has no element at all.
- **Dependency edge buried in JSON.** A metrics-binding's *target* (`sourceId`, host)
  in `payload_json` is unqueryable and can't FK-cascade when its data source is deleted
  — i.e. the "dependency table" wouldn't model the dependency.

**Resolution:** promote the authored skeleton to **per-element rows** (`element`,
`link`) with a **`payload_json` column** for the un-queried payload. Now identity /
attachment / suppression are **FK children of `element` with `ON DELETE CASCADE`** (B1
+ atomicity solved structurally), `element.id` is the stable anchor (B2), and the
binding's target is an FK column (B3). Payload stays JSON → not over-normalized. This
is the Backstage shape applied at element granularity.

## Three layers

| Layer | Contents | Storage |
| --- | --- | --- |
| **① External input** | per-source raw scans (incl. their inline observed attachments) | **JSON snapshot (keep)** — `topology_observations.graph_json` |
| **② Internal** | authored elements/links (skeleton columns + payload doc column); identity; **metrics-binding/policy/access** attachments; suppressions; exclusions | **rows + document column (canonical, FK-enforced)** |
| **③ Output** | resolved graph, exports | **materialized JSON (keep)** — `topology_resolved_graph` (the "stitched/final entity") |

Each *fact* has one home. Note the honest scoping of **②'s `attachment` table = the
authored layer only**; *observed* attachments stay inline in their observation snapshot
(① JSON) and are merged at resolve. So "query the mapping" means the authored bindings
(today the mapping is authored-only by design); if binding-discovery ever emits observed
bindings, they enter via ① and resolve — revisit promoting them then.

## Schema (END STATE)

### Existing (unchanged)
```
topologies              id, name, share_token, composition_revision, ts…   -- shell
data_sources            id, name, type, config_json, status…
topology_data_sources   id, topology_id, data_source_id, purpose, sync_mode, priority, last_synced_at…
topology_observations   …, graph_json                       -- ① INPUT (JSON snapshot)
topology_resolved_graph topology_id, graph_json, layout_json, … built_revision, resolver_version
                                                            -- ③ OUTPUT (materialized stitch)
```

### ② Authored elements (rows + payload document column)
```
element
  id            TEXT PK            -- the graph node/port/subgraph id (round-trips)
  topology_id   TEXT NOT NULL  REFERENCES topologies(id) ON DELETE CASCADE
  kind          TEXT NOT NULL      -- 'node' | 'port' | 'subgraph'
  parent_id     TEXT  REFERENCES element(id) ON DELETE CASCADE   -- port→node, node→subgraph, subgraph→subgraph
  payload_json  TEXT               -- un-queried payload: label, spec/equipment, icon, style,
                                   -- position, metadata. Promote a scalar to a generated
                                   -- column only when a query needs it.

link
  id              TEXT PK
  topology_id     TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE
  from_element_id TEXT REFERENCES element(id) ON DELETE CASCADE   -- node or port
  to_element_id   TEXT REFERENCES element(id) ON DELETE CASCADE
  payload_json    TEXT             -- type, arrow, label, via, bends, cable, style (routing/presentation)
```

### ② Identity, dependency, intent (the mapping/dependency tables — FK children)
```
identity      element_id  TEXT REFERENCES element(id) ON DELETE CASCADE,
              topology_id TEXT NOT NULL,            -- denormalized for the cross-element match index
              key_type    TEXT,  key_value TEXT,    -- 'mgmtIp'|'chassisId'|'sysName'|'ifName'|'ifIndex'|'mac'|'vendorId:<ns>'
              PRIMARY KEY (element_id, key_type, key_value)   WITHOUT ROWID

attachment    id            INTEGER PRIMARY KEY,    -- internal rowid (payload can be >200B → keep rowid)
              topology_id   TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
              element_id    TEXT REFERENCES element(id) ON DELETE CASCADE,  -- NULL ⇔ scope='topology-default'
              scope         TEXT,                   -- 'node' | 'subgraph' | 'topology-default'
              kind          TEXT,                   -- 'access' | 'policy' | 'metrics-binding'
              attachment_key TEXT,                  -- attachmentKey(): 'access:snmp'|'policy'|'metrics-binding:<sourceId>'
              target_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,  -- ★ metrics-binding's dependency target (NULL otherwise)
              payload_json  TEXT                    -- kind leaves: {community,version} | {mode,intervalMs}
                                                    --   | {hostId,interfaceIdentity,interfaceName,bandwidth}
              UNIQUE (element_id, attachment_key)   -- one slot per (element, key); authored layer

suppression   element_id TEXT REFERENCES element(id) ON DELETE CASCADE, attachment_key TEXT,
              PRIMARY KEY (element_id, attachment_key)   WITHOUT ROWID

exclusion     topology_id TEXT REFERENCES topologies(id) ON DELETE CASCADE, key_type TEXT, key_value TEXT,
              PRIMARY KEY (topology_id, key_type, key_value)   WITHOUT ROWID   -- identity-keyed, topology-level
```
- **The `attachment` table is the authored contribution** (always top priority at
  resolve), so it needs no `source`/`priority` columns — both are implied. Reintroduce
  them only if observed attachments are ever promoted into this table.
- **`target_source_id` is the dependency edge made real:** "what binds to source X" is
  an indexed query, and deleting a data source **cascades** its bindings away (detach is
  app logic: delete `attachment WHERE kind='metrics-binding' AND target_source_id=?`).
  The host/interface match keys stay in `payload_json` (promote to columns if a query
  needs them).
- **`element.id` is the stable anchor**, not identity. `identity` rows are the *match
  keys* resolve uses to cluster an authored element with observed contributions; an
  identity-less hand-drawn node simply has no `identity` rows and matches by id only.
  `topology-default` attachments carry `element_id = NULL`.

## Projection / ingestion (the round-trip contract)

```
buildGraph(topologyId): NetworkGraph
  = SELECT element/link/identity/attachment/suppression/exclusion rows for the topology
    (one indexed scan each — NOT per element), assemble into an authored NetworkGraph.
ingestGraph(topologyId, graph)
  = upsert element/link rows (payload_json), replace identity/attachment/suppression by
    key, exclusions — all in ONE transaction. FK ON DELETE CASCADE removes the children
    of any element the import drops (no manual orphan sweep).
```
- **Lossless:** `buildGraph(ingestGraph(g)) ≡ g` (modulo resolve-only fields). A golden
  round-trip test guards this from stage 1.
- **`resolve()` is structurally unchanged** but **the complexity moves, it isn't
  removed:** `buildGraph` is a new, non-trivial component that must reproduce the exact
  authored-`NetworkGraph` the merge expects. resolve still folds authored ⊕ observed by
  identity × key × priority; we feed it `buildGraph()` instead of `readManualGraph()`.
- **Declarative apply** = `ingestGraph` (import a `NetworkGraph`); **export** =
  `buildGraph` (or the resolved projection). The editor and any file workflow operate
  the real data through this — the JSON-operable surface.

## Scope: two persistence worlds (and the unresolved strategic risk)

- **`apps/server` (SQLite)** — this redesign.
- **`apps/editor` (neted, IndexedDB)** — its own local store + product library.
- **M4 — STRATEGIC OPEN QUESTION (not dodged):** server and editor would then hold the
  *same authored domain* (graph, products) in **two different models** = two sources of
  truth long-term. Stated intended end-state: **the server DB is canonical; the editor
  becomes a client of the server through the `NetworkGraph` round-trip API** (or remains
  a standalone tool that explicitly imports/exports). The round-trip contract is the
  bridge. Convergence is tracked as its own effort — **flagged, not solved here.**
- **Equipment / icons** live in `element.payload_json` (matching `Node.spec`/`productId`
  snapshot semantics). A server-side `product` table is a later refinement (promote when
  a shared library / query need is real).

## Staged migration (dependency order; each stage ships independently)

FK direction dictates the order — `element` must exist before its attachment children.

1. **`element` + `link` + `identity` + `buildGraph`/`ingestGraph` + golden round-trip
   test.** Authored *structure* moves out of the Manual `graph_json` into rows. The
   foundation everything else FKs onto.
2. **`metrics-binding` → `attachment`** (highest-pain mapping; `target_source_id` FK).
   `reconcileBindings` writes rows; `buildGraph` re-attaches; `resolve()` unchanged.
3. **`policy` + `access` → `attachment`; `exclusion` + `suppression` → tables.** Reverses
   the `snmp_credentials`→JSON regression; retires `ensureManualSource` for these.
4. **Retire `manual_source_id` / `findManualSourceId`.** Manual becomes an optional
   uniform *hand-drawn source* (its graph = a layer-① snapshot) or is dropped. **#375
   known-gap closed.** Then on-demand generated columns / optional `product` table.
0. **Cleanup (any time):** drop dead tables (`manual_source_graph`, `snmp_credentials`
   — created by deleted migrations, 0 refs, 0 rows).

**Backfill is move-and-strip, not copy (avoids the dual-truth window):** each stage
moves its slice out of the Manual `graph_json` into rows **and removes it from the
JSON** in one migration, so a slice is never live in both places. `buildGraph` reads
rows for migrated slices and the (now-stripped) `graph_json` for the rest; `resolver_version`
bumps so the cache rebuilds.

## Performance & indexing

Reads keep today's speed; writes get dramatically cheaper. Earned with indexes + N+1 avoidance.

- **Read (hot path) — unchanged.** `/context` is served from materialized ③ (~19ms /
  1475 nodes). ② is touched only on rebuild.
- **Write — the big win.** A binding edit goes from "read→mutate→write the *entire*
  `graph_json`" (O(graph)) to **one `attachment` row UPSERT/DELETE (O(1))**.
- **Query — indexed.** "bindings for source X", "disabled nodes", "what depends on
  source X" are indexed SQL, not graph-walks.
- **Rebuild — DB is not the bottleneck.** `computeNetworkLayout` (CPU) + the ③ Map-aware
  serialize dominate; both unchanged here (`performance-scaling.md`).

**Index every FK column (SQLite does NOT auto-index FKs).** With `foreign_keys = ON` +
`ON DELETE CASCADE`, an un-indexed child FK makes each cascade a full table scan
(sqlite.org/foreignkeys.html). Concretely:
- `element(topology_id)`, `element(parent_id)`
- `link(topology_id)`, `link(from_element_id)`, `link(to_element_id)`
- `attachment(topology_id, element_id)` (per-element fold; covers `element_id` via prefix)
- `attachment(topology_id, kind)` — "all bindings/policies of a kind"
- `attachment(target_source_id)` — "what depends on source X" + cascade on source delete
- `identity` reverse index `(topology_id, key_type, key_value)` — the cross-element merge match
- `suppression` / `exclusion` / `identity` PKs are their indexes (WITHOUT ROWID)
- no redundant prefixes; **never index `payload_json`**; cover only small key/existence outputs

**Avoid N+1:** `buildGraph` fetches each table **once per topology** and assembles in
memory — never per-element queries.

**Primary-key strategy.** `element.id` / `link.id` are the graph ids → **TEXT** (must
round-trip). `attachment` keeps an **`INTEGER PRIMARY KEY`** (payload can exceed the
WITHOUT-ROWID ~200 B/page-1⁄20 threshold). `identity` / `suppression` / `exclusion` are
small composite-key tables → **`WITHOUT ROWID`** (~2× faster, ~50% less space; verify
row size with `sqlite3_analyzer`). External entities (topologies, data_sources) keep
TEXT nanoid.

**Push work into SQL** (filter/aggregate/exists in queries, not JS loops over parsed
JSON) — the whole point of relationalizing ②.

**Connection PRAGMAs.** Shipped in PR #377: `journal_mode=WAL`, `synchronous=NORMAL`,
`foreign_keys=ON`, `busy_timeout=5000`, `cache_size=-65536`, `temp_store=MEMORY`,
`mmap_size=256MiB`; `PRAGMA optimize` on close, `ANALYZE` after large backfills.

**`doc_json`/`payload_json` storage.** SQLite 3.51.1 (bun 1.3.4) has JSONB, but **TEXT
is the default** (we read whole payloads and parse in JS); reserve JSONB + generated
columns for scalars we actually filter on.

**Measure with `EXPLAIN QUERY PLAN`** — confirm every hot query hits an index
(no `SCAN TABLE`). Add phase timing (DB read / merge / layout / ③ write) around resolve.

## Risks / open questions

- **`buildGraph` complexity** — it now owns reconstructing the exact authored
  `NetworkGraph`; the golden round-trip test must exist from stage 1.
- **Identity-less authored nodes** — match by `element.id` only (no `identity` rows);
  confirm resolve's cluster step handles id-only authored members (it does today via the
  node-id fallback — preserve it).
- **Detach vs delete of a metrics source** — FK cascades on data-source *delete*; *detach*
  (removing the m2m junction) must delete the source's bindings in app logic, mirroring
  PR #375's detach-clears-observations.
- **`attachment` table = authored only** — observed attachments remain in ① JSON; "query
  the mapping" is authored-scoped until/unless binding-discovery lands.
- **No authored history** — `composition_revision` (cache) + `element.…`-level
  `updated_at` only; there is **no version/undo history** for authored data (dropped the
  earlier misleading "version" claim). A version/event-log is a separate future feature.
- **Editor convergence (M4)** — the standing strategic risk above.

## References (prior art, verified 2026-06)
- Backstage — entity document + relations table + stitching/orphan-sweep: <https://backstage.io/docs/features/software-catalog/life-of-an-entity/>, <https://backstage.io/docs/features/software-catalog/creating-the-catalog-graph/>
- Grafana App Platform — K8s-style resources over SQL unified storage: <https://deepwiki.com/grafana/grafana/3.3-folder-management>
- PostgreSQL JSONB + generated columns; modern hybrid (2025): <https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage>, <https://200oksolutions.com/blog/modern-database-architectures-hybrid-approach-sql-nosql-newsql-2025/>
- SQLite JSON/JSONB + virtual generated columns: <https://sqlite.org/json1.html>, <https://www.dbpro.app/blog/sqlite-json-virtual-columns-indexing>
- SQLite foreign keys — FK columns are NOT auto-indexed: <https://www.sqlite.org/foreignkeys.html>
- SQLite WITHOUT ROWID — composite PK, <~1/20-page rows: <https://www.sqlite.org/withoutrowid.html>
- SQLite query planner — covering indexes, compound order, ANALYZE: <https://www.sqlite.org/queryplanner.html>
- Production PRAGMAs: <https://databaseschool.com/articles/sqlite-recommended-pragmas>; bun:sqlite: <https://bun.com/docs/runtime/sqlite>

## Relationship to existing docs
- `topology-composition-store.md` — predecessor; its identity-keyed-store intent is realized here.
- `manual-source-unification.md` — its known-gap is closed by stages 1–4.
- `topology-ui-ia.md` — unaffected (UI reads the same projected graph).
