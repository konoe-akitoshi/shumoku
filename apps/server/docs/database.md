# Database Schema

Shumoku Server uses SQLite (via `bun:sqlite`) for persistent storage. The database file is stored at `{dataDir}/shumoku.db`.

## Overview

```
┌─────────────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│  data_sources   │     │  topology_data_sources  │     │      topologies      │
│─────────────────│     │─────────────────────────│     │──────────────────────│
│ id (PK)         │◄────│ data_source_id (FK)     │     │ id (PK)              │
│ name            │     │ topology_id (FK)        │────►│ name                 │
│ type            │     │ purpose (topology|      │     │ share_token          │
│ config_json     │     │          metrics)       │     │ composition_revision │
│ status …        │     │ sync_mode, priority …   │     │ created_at, updated… │
└─────────────────┘     └─────────────────────────┘     └──────────────────────┘
   (incl. type='manual': an ordinary, explicitly-added hand-drawn source)

  ┌──────────────────────────────────────────────┐  ┌──────────────────────────┐
  │  contribution_* (DB-NATIVE — the canonical    │  │  topology_resolved_graph │
  │  composition store; resolve() reads THIS)     │  │──────────────────────────│
  │──────────────────────────────────────────────│  │ topology_id (PK, FK)     │
  │ contribution_source (topology_id, source_id)  │  │ graph_json               │
  │   attachment_id SET  = a source contribution  │  │ layout_json              │
  │   attachment_id NULL = the PROJECT OVERLAY    │  │ icon_dimensions_json     │
  │   (operator curation; source_id='intrinsic')  │  │ built_revision           │
  │ contribution_element / _identity / _link /    │  │ resolver_version         │
  │   _link_via / _attachment  (decomposed graph) │  │ computed_at              │
  └──────────────────────────────────────────────┘  └──────────────────────────┘
                                                       derived artifact, 1/topology
  ┌──────────────────────────┐
  │  topology_observations   │  append-only AUDIT/HISTORY log only.
  │──────────────────────────│  resolve() does NOT read this — it reads
  │ id, topology_id,         │  contribution_*. record() materializes each
  │ source_id, captured_at,  │  snapshot into a contribution in one txn.
  │ status, graph_json …     │
  └──────────────────────────┘

┌─────────────┐  ┌────────────┐  ┌──────────────────────────────┐
│ dashboards  │  │  settings  │  │ migrations (id, name, applied)│
└─────────────┘  └────────────┘  └──────────────────────────────┘
(+ auth / share-token / grafana-alert tables — see migrations 005-007)
```

**Composition model (since the DB-native persistence refactor):** a topology is a
shell; its sources live in `topology_data_sources` (m2m, by purpose). Every
contribution is stored DB-native in the `contribution_*` store, keyed by
`(topology_id, source_id)`, in **two kinds** distinguished by `attachment_id`:

- **source contributions** (`attachment_id` SET) — every attached source's latest
  graph, INCLUDING an explicitly-added hand-drawn `type='manual'` source. A Manual
  source is ordinary: its editor save records an observation that materializes here,
  the SAME path as any source (no manual-specific code).
- **the project overlay** (`attachment_id` NULL, sentinel `source_id='intrinsic'`,
  one per topology via `idx_contrib_one_intrinsic`) — the operator's **curation**:
  exclusions, field overrides, metrics bindings, display settings. Owned by the
  project, **not a data source**; writing it never creates/attaches anything.

`resolve()` reads the `contribution_*` rows (NOT `topology_observations`), folds the
project overlay as the top-priority `authored` input plus every source contribution
by priority, and materializes the result in `topology_resolved_graph` (invalidated by
`composition_revision`). `topology_observations` is now just the append-only
audit/history log. The **metrics mapping** is not a column — it is `metrics-binding`
attachments folded onto the resolved graph. See
`docs/design/db-native-persistence.md` (storage), `topology-source-priority-merge.md`
(merge), and `manual-source-unification.md` (Manual = uniform source).

## Tables

### data_sources

External data source connections (Zabbix, NetBox, Prometheus, etc.)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Display name |
| `type` | TEXT | Plugin type: `zabbix`, `netbox`, `prometheus` |
| `config_json` | TEXT | Plugin-specific configuration (JSON) |
| `status` | TEXT | Connection status: `connected`, `disconnected`, `unknown` |
| `status_message` | TEXT | Last status message (error details, etc.) |
| `last_checked_at` | INTEGER | Last health check timestamp (ms) |
| `fail_count` | INTEGER | Consecutive failure count |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

**config_json examples:**

```json
// Zabbix
{
  "url": "https://zabbix.example.com/api_jsonrpc.php",
  "token": "api_token_here",
  "pollInterval": 5000
}

// Prometheus
{
  "url": "http://prometheus:9090",
  "preset": "snmp",
  "hostLabel": "hostname",
  "jobFilter": "snmp"
}

// NetBox
{
  "url": "https://netbox.example.com",
  "token": "api_token_here",
  "groupBy": "site"
}
```

### topologies

Topology **shell** only. Graph content lives in the `contribution_*` store (source
contributions + the project overlay); the metrics mapping lives as `metrics-binding`
attachments folded onto the resolved graph (no column). Legacy columns `content_json`
(dropped m010), `topology_source_id` / `metrics_source_id` / `mapping_json` (dropped in
the composition-store refactor) are gone.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Topology name |
| `share_token` | TEXT | Public-share token (NULL when not shared) |
| `composition_revision` | INTEGER | Bumped on any composition input change; invalidates the materialized resolved graph (O(1)) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

### topology_observations

One row per source-scan snapshot — the append-only **audit/history log** (retention
enforced on write). `resolve()` does **NOT** read this; it reads the `contribution_*`
store. `ObservationsService.record()` writes the audit row AND materializes the
snapshot into a contribution in one transaction (so they can't diverge). A hand-drawn
Manual source's editor save records here too (the human is the "scanner").

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `topology_id` | TEXT (FK) | Reference to topologies.id |
| `source_id` | TEXT (FK) | Reference to data_sources.id |
| `captured_at` | INTEGER | Scan/capture timestamp (ms) |
| `status` | TEXT | `ok` \| `partial` \| `failed` \| `empty` |
| `status_message` | TEXT | Optional message for status != ok |
| `graph_json` | TEXT | Serialized NetworkGraph (NULL when failed) |
| `node_count` / `link_count` / `port_count` | INTEGER | Cheap counters for list/debug |
| `created_at` | INTEGER | Row creation timestamp (ms) |

### topology_resolved_graph

Materialized resolver output (1 per topology) so reads/polls skip
re-resolve + re-layout. Served only when `built_revision` equals the topology's
current `composition_revision` and `resolver_version` matches the code constant;
otherwise recomputed.

| Column | Type | Description |
|--------|------|-------------|
| `topology_id` | TEXT (PK, FK) | Reference to topologies.id |
| `graph_json` | TEXT | Resolved NetworkGraph |
| `layout_json` | TEXT | `computeNetworkLayout()` output `{layout, resolved}` (Map-aware encoded) |
| `icon_dimensions_json` | TEXT | Resolved icon dimensions (entries) |
| `built_revision` | INTEGER | `composition_revision` this was built from |
| `resolver_version` | INTEGER | Resolve/layout algorithm version |
| `computed_at` | INTEGER | Build timestamp (ms) |

### contribution_* (DB-native contribution store)

The canonical composition store (migration `016`). Each source's graph — and the
project overlay — is decomposed into queryable rows here; `resolve()` reads these
(via `buildContributions`/`buildGraph`) and `ingestGraph` writes them. A contribution
is keyed by `(topology_id, source_id)`.

| Table | Purpose |
|-------|---------|
| `contribution_source` | One row per contribution. `attachment_id` SET = a source contribution (FK to its `topology_data_sources` attach row → detach cascades it); `attachment_id` NULL = the **project overlay** (operator curation, `source_id='intrinsic'`). Holds `last_status` / `last_ok_at` (replace strategy) + `graph_payload_json` (graph-level fields: version/name/settings/pins). |
| `contribution_element` | node / port / subgraph / termination rows. `presence` is `'present'` (scoop) \| `'hide'` \| NULL (anchor); `payload_json` is the lossless catch-all. |
| `contribution_identity` | normalized match keys (mgmtIp/chassisId/sysName/vendorId) resolve clusters on. |
| `contribution_link` | links with four endpoint FKs (from/to node + optional port). |
| `contribution_link_via` | ordered termination transits for a link's `via`. |
| `contribution_attachment` | `access` / `policy` / `metrics-binding` attachments, with `negate` (0=assert, 1=suppress) and `target_source_id` (binding dependency). |

**Key indexes:** `idx_contrib_one_per_attach` (one contribution per attach row),
`idx_contrib_one_intrinsic` (one project overlay per topology, `attachment_id` NULL).
All FKs are explicitly indexed (SQLite does not auto-index FKs). See
`docs/design/db-native-persistence.md` for the full schema + invariants.

### topology_data_sources

Junction table for topology-datasource relationships (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `topology_id` | TEXT (FK) | Reference to topologies.id |
| `data_source_id` | TEXT (FK) | Reference to data_sources.id |
| `purpose` | TEXT | `topology` or `metrics` |
| `sync_mode` | TEXT | `manual`, `on_view`, or `webhook` |
| `webhook_secret` | TEXT | Secret for webhook validation (optional) |
| `last_synced_at` | INTEGER | Last sync timestamp (ms) |
| `priority` | INTEGER | Priority order — **higher number = higher precedence** in the resolver field-merge (`resolve()` sorts `priority desc`). The project overlay always outranks every source (fed as the top-priority `authored` input, effectively +∞). |
| `consecutive_failures` | INTEGER | Retraction hysteresis counter |
| `last_ok_captured_at` | INTEGER | Last successful capture timestamp (ms) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

**Unique constraint:** `(topology_id, data_source_id, purpose)`

### dashboards

Dashboard layouts for displaying multiple topologies.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Dashboard name |
| `layout_json` | TEXT | Widget layout configuration (JSON) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

### settings

Key-value store for application settings.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT (PK) | Setting key |
| `value` | TEXT | Setting value |

### migrations

Tracks applied database migrations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Auto-increment ID |
| `name` | TEXT (UNIQUE) | Migration filename (e.g., `001_initial.sql`) |
| `applied_at` | INTEGER | Timestamp when applied (ms) |

## Indexes

| Index | Table | Columns |
|-------|-------|---------|
| `idx_topologies_name` | topologies | name |
| `idx_data_sources_name` | data_sources | name |
| `idx_data_sources_type` | data_sources | type |
| `idx_topology_data_sources_topology` | topology_data_sources | topology_id |
| `idx_topology_data_sources_source` | topology_data_sources | data_source_id |
| `idx_topology_observations_topology_source` | topology_observations | topology_id, source_id, captured_at DESC |
| `idx_topology_observations_captured_at` | topology_observations | captured_at |

(`idx_topologies_topology_source` / `idx_topologies_metrics_source` were dropped
with their columns in the composition-store refactor.)

## Migrations

Schema migrations use numbered SQL files in `src/db/migrations/`. On startup, the server automatically applies any pending migrations.

| File | Description |
|------|-------------|
| `001_initial.sql` | Initial schema (tables, indexes) |
| `002_health_check.sql` | Health check status fields for data_sources |
| `003_topology_data_sources.sql` | Junction table for many-to-many relationships |
| `004_topology_source_options.sql` | Per-attachment options |
| `005_auth.sql` / `006_share_tokens.sql` / `007_grafana_alerts.sql` | Auth, share tokens, alerts |
| `008_topology_observations.sql` | Observation snapshots + hysteresis columns |
| `010_manual_as_source.sql` / `011_manual_graph_to_config.sql` | Authored content → Manual source (content_json dropped) |
| `012_resolved_graph_cache.sql` | `composition_revision` + `topology_resolved_graph` |
| `013_drop_legacy_source_columns.sql` | Backfill legacy source pointers → m2m, then drop the columns |
| `014_manual_graph_to_observations.sql` | Manual authored graph `config_json.graph` → per-topology observation (reverses 011) |
| `016_contribution_store.sql` | **DB-native contribution store** (`contribution_source`/`element`/`identity`/`link`/`link_via`/`attachment`) — the canonical composition store resolve() reads |
| `017_drop_dead_tables.sql` | Drop dead tables (`manual_source_graph`, `snmp_credentials`) |

(`009` and `015` are intentionally skipped. Two startup-time imperative migrations
run AFTER SQL migrations — they need the resolver / TS, so they aren't SQL files:
the `mapping_json` → bindings backfill, and `migrateManualToProject` which folds any
legacy Manual content into each topology's project overlay and retires the Manual
data sources, both settings-guarded one-shots.)

**Adding a new migration:**

1. Create `src/db/migrations/NNN_description.sql` (increment number)
2. Write SQL statements (CREATE TABLE, ALTER TABLE, etc.)
3. Restart server - migration applies automatically

**Note:** Migrations are tracked in the `migrations` table, not `settings`.

## TypeScript Interfaces

See `apps/server/src/types.ts` for corresponding TypeScript interfaces:

- `DataSource` - data_sources table
- `Topology` - topologies table (shell)
- `TopologyDataSource` - topology_data_sources table
- `TopologyObservation` - topology_observations table
- `Dashboard` - dashboards table
- `MetricsMapping` (core `plugin-types.ts`) - the mapping shape derived from
  `metrics-binding` attachments at read/poll time (no longer a stored column)

## Database Configuration

- **Location:** `{dataDir}/shumoku.db` (default: `./data/shumoku.db`)
- **Journal mode:** WAL (Write-Ahead Logging) for better concurrency
- **Foreign keys:** Enabled (`PRAGMA foreign_keys = ON`)
- **ID generation:** nanoid (12 characters)

## Backup

DB は **WAL モード**で動作します。直近の書き込みは `shumoku.db-wal` に残り、停止して
もチェックポイントは強制されないため、`shumoku.db` 単体のコピーは不完全になり得ます
（ほぼ空になることもある）。`shumoku.db` / `-wal` / `-shm` を揃えて取得してください。

**サーバー停止中（推奨）:**
```bash
cp ./data/shumoku.db* ./backup/    # shumoku.db / shumoku.db-wal / shumoku.db-shm
```

**サーバー稼働中（WALモード対応、`sqlite3` が必要）:**
```bash
sqlite3 ./data/shumoku.db ".backup './backup/shumoku.db'"
```

**リストア:**
```bash
# サーバーを停止してから 3 ファイルを戻す
cp ./backup/shumoku.db* ./data/
```

**マイグレーション前のバックアップ:**
スキーマ変更を含むアップデート前には手動でバックアップを取ることを推奨します。
