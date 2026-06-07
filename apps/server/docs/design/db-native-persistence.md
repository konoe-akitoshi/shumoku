# DB-native persistence — document + relations, the modern hybrid

> Status: DRAFT (2026-06-07). Design of record for the follow-up to PR #375 (#362).
> Supersedes the storage framing in `topology-composition-store.md` and the
> known-gap in `manual-source-unification.md`. No backward compatibility.

## Thesis

The server conflated two "types":

1. **`@shumoku/core`'s `NetworkGraph`** — the library's interchange / serialization
   format (parser output, renderer input, every export). JSON-shaped, correctly so.
   **Stays untouched.**
2. **The server's persistence model** — what the *application* stores and queries.
   It was just (1) pickled as a blob; three refactors (`content_json` →
   `config_json.graph` → `topology_observations.graph_json`) only *moved* the blob,
   never cutting the **"core type == storage model"** coupling. That debt surfaces as:
   editing the composed graph spawns a phantom Manual source; "Manual is uniform"
   is skin-deep; the metrics mapping can't be queried, indexed, or partially updated.

> **North star.** The **DB is canonical**. `NetworkGraph` (JSON) is a **lossless,
> bidirectional operation surface**: read/export *projects* the DB to a graph;
> write/import *decomposes* a graph into the DB; `JSON → DB → JSON` is identical for
> real data. Nothing is DB-only-inexpressible-in-JSON, nothing is JSON-only-bypassing-DB.

## Chosen architecture: document + relations (the modern hybrid)

Researching how "DB-backed but JSON-operable" tools are actually built (2024–2025)
shows a clear convergence — **not** "fully normalize everything," and **not** "one
big blob," but a hybrid:

- **Storage = document + generated-column indexes.** Store the resource as JSON(B);
  *promote only the queried fields* to generated columns + indexes. Postgres
  (JSONB + generated columns/expression indexes) and **SQLite ≥ 3.45 (2024): JSONB
  type + virtual generated columns over `json_extract` + indexes** both do this
  natively. You keep the document AND get B-tree query speed — no false choice.
- **Relations = a normalized edge/dependency table.** Backstage stores entities as
  documents but emits a dedicated **`relations` table** for the graph edges (used for
  traversal, orphan detection, cascade delete). Edges/keys are normalized; payload
  is document.
- **Resource model + declarative apply + reconcile.** Grafana's App Platform now
  models dashboards as **K8s-style resources (metadata/spec/status, apiVersion)** over
  a **SQL unified storage** backend, with a declarative API. Processing = `spec ⊕
  observed → reconcile/stitch → materialized status`.

**The split-canonical rule** (this is the key line):

> **Edges, dependencies, and identity keys = normalized relational tables (truth).**
> **Element payload (label, equipment/spec, icon, style, position) = JSON document
> (truth) + generated columns for the scalars you query.**
> Neither "all tables" nor "all blob."

This solves the user's stated concerns exactly: the **mapping / dependency** data
becomes relational rows (queryable, partial-updatable, merge-by-identity), while
equipment/icons/style stay in the document (promote to generated columns only if a
query needs them — no over-normalization).

## Three layers

| Layer | Contents | Storage |
| --- | --- | --- |
| **① External input** | per-source raw scans | **JSON snapshot (keep)** — `topology_observations.graph_json` |
| **② Internal — document** | authored *structure*: nodes/links/subgraphs/terminations + payload (label, equipment/spec, **icon**, style, position) | **JSONB document (canonical)** + generated columns as needed |
| **② Internal — relations** | identity keys, **metrics-binding (the mapping)**, policy, access, exclusions, suppressions | **normalized tables (canonical)** |
| **③ Output** | resolved graph, exports | **materialized JSON (keep)** — `topology_resolved_graph` (= the "stitched/final entity") |

Each fact has exactly one home: structure → ②-document or ① (observed); dependency /
intent / identity → ②-relations. No double truth.

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

### ②-document — authored structure (replaces "the Manual source's graph")
```
authored_graph
  topology_id   TEXT PK FK
  doc_json      TEXT (JSONB)   -- authored NetworkGraph STRUCTURE: nodes/links/subgraphs/
                               -- terminations/pins + payload (label, spec/equipment, icon,
                               -- style, position). MINUS dependency/intent attachments
                               -- (those are relations rows).
  version       INTEGER        -- bump per save (cheap history; cf. Grafana dashboard_version)
  updated_at    INTEGER
  -- Promote queried scalars as generated columns + indexes WHEN a query needs them, e.g.:
  --   node_count INT GENERATED ALWAYS AS (json_array_length(doc_json,'$.nodes')) VIRTUAL
  -- Don't pre-normalize; add on demand.
```
Topology-owned. **Not a Manual source.** This kills "editing spawns a Manual."

### ②-relations — identity, dependency, intent (the "mapping/dependency tables")
```
identity     id, topology_id, element_kind('node'|'port'|'subgraph'), element_ref,
             key_type('mgmtIp'|'chassisId'|'sysName'|'ifName'|'ifIndex'|'mac'|'vendorId:<ns>'),
             key_value
             UNIQUE(topology_id, element_kind, element_ref, key_type, key_value)

attachment   id, topology_id, element_kind, element_ref,
             scope('node'|'subgraph'|'topology-default'),
             kind('access'|'policy'|'metrics-binding'),
             attachment_key,           -- attachmentKey(): 'access:snmp'|'policy'|'metrics-binding:<sourceId>'
             source,                   -- 'authored' | data_source_id  (provenance)
             priority,
             payload_json              -- {community,version} | {mode,intervalMs} |
                                       -- {sourceId,hostId,interfaceIdentity,interfaceName,bandwidth}

suppression  topology_id, element_kind, element_ref, attachment_key   PK(all)   -- human delete
exclusion    topology_id, key_type, key_value                         PK(all)   -- hidden node by identity
```
- `element_ref` is **identity-anchored** (resolve joins by identity, so refs survive
  re-id / re-scan). An authored attachment on an *observed* node = rows here keyed by
  that node's identity, no document node required.
- **The metrics mapping = `attachment WHERE kind='metrics-binding'`** — one row per
  (element, source), queryable and partially updatable. `access` returns to relational
  (reverses the `snmp_credentials`→JSON regression).

## Projection / ingestion (the round-trip contract)

```
buildGraph(topologyId): NetworkGraph
  = authored_graph.doc_json  (structure + payload)
    ⊕ re-attach attachment/identity/exclusion rows by identity   → authored NetworkGraph
ingestGraph(topologyId, graph)
  = split graph → authored_graph.doc_json (structure)            (upsert, version++)
    + identity / attachment / exclusion / suppression rows       (replace by key)
```
- **Lossless:** `buildGraph(ingestGraph(g)) ≡ g` (modulo server ids / resolve-only
  fields). A golden round-trip test guards this before structure migrates.
- **`resolve()` is unchanged** — it already stitches an authored `NetworkGraph` with
  observed snapshots by identity × key × priority. We feed it `buildGraph()` output
  instead of `readManualGraph()`. Output still materializes to `topology_resolved_graph`.
- **Declarative apply** = `ingestGraph` (import a `NetworkGraph`); **export** =
  `buildGraph` (or the resolved projection). The editor (neted) and any file-based
  workflow operate the real data through this — the "JSON-operable" surface.

## Scope: two persistence worlds

- **`apps/server` (SQLite)** — this redesign. Gains ②-document + ②-relations.
- **`apps/editor` (neted, IndexedDB)** — its own local working store + product
  library; **out of scope.** It interoperates via `NetworkGraph` JSON (= a declarative
  apply client). Editor⇄server convergence is a future question; the round-trip
  contract is what makes it possible later.
- **Equipment / icons** live in ②-document payload (matching `Node.spec`/`productId`
  snapshot semantics). A server-side `product` table is a *later* refinement (promote
  when a shared library / query need is real) — not required for the hybrid.

## Staged migration (each stage ships independently)

0. **Design + cleanup.** This doc. Drop dead tables (`manual_source_graph`,
   `snmp_credentials` — created by deleted migrations, 0 refs, 0 rows).
1. **`metrics-binding` → `attachment` + `identity`.** Highest pain, identity-keyed,
   independent. `reconcileBindings` writes rows; `buildGraph` re-attaches them;
   `resolve()` unchanged. Backfill from Manual `graph_json`.
2. **`policy` + `access` → `attachment`; `exclusion` + `suppression` → tables.**
   Retire `ensureManualSource` for these; reverse the credentials regression.
3. **Authored structure → `authored_graph`.** Stand up `buildGraph`/`ingestGraph` +
   the golden round-trip test. Retire `manual_source_id` / `findManualSourceId`;
   Manual becomes an optional uniform *hand-drawn source* (its graph = a layer-①
   snapshot) or is dropped. **#375 known-gap closed.**
4. **(On demand) generated columns** for hot queries; optional `product` table;
   `(deferred/maybe never)` normalize *observed* structure (layer ①).

Per stage, `buildGraph` reads new tables for migrated slices and old `graph_json` for
the rest (dual-read window); `resolver_version` bumps so the cache rebuilds.

## Performance & indexing

Net effect is **positive**: reads keep today's speed, writes get dramatically
cheaper. The wins must be earned with index design and N+1 avoidance.

- **Read (hot path) — unchanged.** `/context` is served from the materialized ③
  `topology_resolved_graph` (measured ~19ms / 1475 nodes). The internal model is only
  touched on rebuild, so relationalizing ② does **not** slow reads.
- **Write — the big win.** A single binding edit goes from "read → mutate → write the
  *entire* `graph_json`" (O(graph)) to **one `attachment` row UPSERT/DELETE (O(1))**.
  This is the headline benefit for the edit-heavy authoring workflow.
- **Query — indexed, not full-scan.** "bindings for source X", "disabled nodes" become
  indexed SQL instead of graph-walks over parsed JSON.
- **Rebuild — comparable; DB is not the bottleneck.** On `composition_revision`
  invalidation: `① observations (parse) ⊕ ② (doc parse + relations scan) → merge →
  layout → ③ write`. With the indexes below, ② is an indexed scan per table. The real
  cost is `computeNetworkLayout` (CPU) and the ③ Map-aware JSON serialize — both
  unchanged by this design and addressed separately (`performance-scaling.md`).

**Indexes (design up front):**
- every ②-relations table: `topology_id`
- `attachment(topology_id, element_kind, element_ref)` — per-element fold
- `attachment(topology_id, kind, source)` — "bindings by source" queries
- `identity` UNIQUE `(topology_id, element_kind, element_ref, key_type, key_value)`
  + reverse `(topology_id, key_type, key_value)` for the merge's identity match
- observation prune already supported by `(topology_id, source_id, captured_at DESC)`

**Avoid N+1 (the main pitfall):** `buildGraph` must fetch each relations table **once
per topology** (single indexed scan) and assemble in memory — never per-element queries.

**Primary-key strategy (Shumoku-specific — we use nanoid TEXT PKs everywhere).** TEXT
PKs are a real cost on the high-row-count internal tables: a TEXT PK leaves the hidden
`rowid` AND stores the string in every index, vs an `INTEGER PRIMARY KEY` which *is* the
rowid (one fast B-tree, less storage — Android's guidance). So:
- Keep **TEXT nanoid** for externally-referenced entities (topologies, data_sources —
  they appear in URLs / the API).
- For internal, never-URL-exposed, high-volume relations tables (`identity`,
  `attachment`), prefer **`INTEGER PRIMARY KEY`**, or **`WITHOUT ROWID` with the natural
  composite key** for `suppression` / `exclusion` (composite PKs, no surrogate id needed).

**Push work into SQL, don't re-walk JSON in app code.** Filtering / aggregation /
existence checks belong in queries (SQLite's engine ≫ JS loops), which is the whole
point of relationalizing ② — e.g. "bindings for source X" is an indexed `WHERE`, not a
`graph.nodes.flatMap(...)` over a parsed blob. (`COUNT(*)`/`EXISTS`/`LIMIT`, select only
needed columns.)

**SQLite levers:**
- `doc_json` as **TEXT is the safe default** (we read the whole doc and parse in JS);
  reserve **JSONB + generated columns** for scalars we actually filter on (promote on
  demand, STORED+index for hot filters / expression index for rare ones).
- WAL is on (concurrent read during scheduler writes); set `synchronous=NORMAL`,
  `busy_timeout`, and a sensible `cache_size`/`mmap_size`.
- Batch in **one transaction**: `reconcileBindings`' N-row replace, and `ingestGraph`.
- Keep using bun:sqlite prepared statements (`.query()` cache).

**Measure with `EXPLAIN QUERY PLAN` (+ SQLite's `.expert`)**, not by guessing — confirm
every hot query hits an index (no `SCAN TABLE`). Add phase timing (DB read / merge /
layout / ③ write) around resolve; today only the cache-hit path (~19ms) is measured, the
rebuild path is what to instrument. (Prior art: Bencher cut response time ~1200× with
exactly this — targeted compound indexes + a materialized view, found via EXPLAIN.)

## Risks / open questions

- **Round-trip golden test must exist before stage 3** or losslessness is unverified.
- **Backfill** per stage: move the slice out of Manual `graph_json`, then drop it from
  the JSON (no-backcompat; one-time, then delete the old path).
- **`element_ref` identity model** — confirm identity-anchored refs handle the
  "authored attachment on an observed-only node" case (the empty-overlay-node the
  current code already prunes post-merge).
- **`doc_json` as JSONB vs TEXT** — SQLite JSONB needs 3.45+ and bun:sqlite's bundled
  SQLite version; verify before relying on the JSONB type (TEXT + `json_extract`
  generated columns works regardless and is the safe default).
- **Editor convergence / `product` table** — deliberately deferred.

## References (prior art, verified 2026-06)
- PostgreSQL JSONB hybrid + generated columns: <https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage>, <https://richyen.com/postgres/2026/05/11/generated_columns_jsonb.html>
- Modern hybrid DB architectures (2025): <https://200oksolutions.com/blog/modern-database-architectures-hybrid-approach-sql-nosql-newsql-2025/>
- SQLite JSON / JSONB + virtual generated columns: <https://sqlite.org/json1.html>, <https://www.dbpro.app/blog/sqlite-json-virtual-columns-indexing>
- Grafana App Platform — K8s-style resources over SQL unified storage: <https://deepwiki.com/grafana/grafana/3.3-folder-management>
- Backstage — entity document + relations table + stitching: <https://backstage.io/docs/features/software-catalog/life-of-an-entity/>, <https://backstage.io/docs/features/software-catalog/creating-the-catalog-graph/>
- SQLite performance best practices (Android) — INTEGER PK, compound indexes, WAL+synchronous, transactions, EXPLAIN QUERY PLAN, push work into SQL: <https://developer.android.com/topic/performance/sqlite-performance-best-practices>
- SQLite performance tuning (Bencher) — compound indexes + materialized view + EXPLAIN/`.expert`, ~1200× win: <https://bencher.dev/learn/engineering/sqlite-performance-tuning/>

## Relationship to existing docs
- `topology-composition-store.md` — predecessor; its identity-keyed-store intent is realized here; `metrics-binding`-as-attachment = stage-1 input.
- `manual-source-unification.md` — its known-gap is closed by stages 1–3.
- `topology-ui-ia.md` — unaffected (UI reads the same projected graph).
