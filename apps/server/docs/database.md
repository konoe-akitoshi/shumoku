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
   ▲  type='manual' rows hold the authored graph at config_json.graph
   │
   │   ┌──────────────────────────┐     ┌──────────────────────────┐
   └───│  topology_observations   │     │  topology_resolved_graph │
       │──────────────────────────│     │──────────────────────────│
       │ id (PK)                  │     │ topology_id (PK, FK)     │
       │ topology_id (FK)         │     │ graph_json               │
       │ source_id (FK)           │     │ layout_json              │
       │ captured_at, status      │     │ icon_dimensions_json     │
       │ graph_json (snapshot)    │     │ built_revision           │
       │ node/link/port_count     │     │ resolver_version         │
       └──────────────────────────┘     │ computed_at              │
        one per source-scan (history)   └──────────────────────────┘
                                          derived artifact, 1 per topology

┌─────────────┐  ┌────────────┐  ┌──────────────────────────────┐
│ dashboards  │  │  settings  │  │ migrations (id, name, applied)│
└─────────────┘  └────────────┘  └──────────────────────────────┘
(+ auth / share-token / grafana-alert tables — see migrations 005-007)
```

**Composition model (since the composition-store refactor):** a topology is a
shell; its sources live in `topology_data_sources` (m2m, by purpose); each
source's scans are appended to `topology_observations`; the human-authored graph
lives on the Manual source's `config_json.graph`; `resolve()` folds these into
the displayed graph, which is materialized in `topology_resolved_graph` and
invalidated by `composition_revision`. The **metrics mapping** is no longer a
column — it is `metrics-binding` attachments on the resolved graph (see
`docs/design/topology-composition-store.md`).

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

Topology **shell** only. Graph content lives in observations / the Manual
source; the metrics mapping lives as `metrics-binding` attachments on the
resolved graph (no column). Legacy columns `content_json` (dropped m010),
`topology_source_id` / `metrics_source_id` / `mapping_json` (dropped in the
composition-store refactor) are gone.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Topology name |
| `share_token` | TEXT | Public-share token (NULL when not shared) |
| `composition_revision` | INTEGER | Bumped on any composition input change; invalidates the materialized resolved graph (O(1)) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

### topology_observations

One row per source-scan snapshot (append-only history; retention enforced on
write). `resolve()` folds the latest non-failed snapshot per source plus the
authored graph into the displayed graph.

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
| `priority` | INTEGER | Priority order (lower number = higher precedence in the resolver field-merge) |
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

(`009` is intentionally skipped. `mapping_json` is dropped imperatively by the
startup backfill after migrating it to bindings — not by a SQL migration — since
the data move needs the resolver.)

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

SQLiteはファイルベースなので、DBファイルをコピーするだけでバックアップできます。

**サーバー停止中（推奨）:**
```bash
cp ./data/shumoku.db ./data/shumoku_backup_$(date +%Y%m%d_%H%M%S).db
```

**サーバー稼働中（WALモード対応）:**
```bash
sqlite3 ./data/shumoku.db ".backup './data/shumoku_backup.db'"
```

**リストア:**
```bash
# サーバーを停止してから
cp ./data/shumoku_backup.db ./data/shumoku.db
```

**マイグレーション前のバックアップ:**
スキーマ変更を含むアップデート前には手動でバックアップを取ることを推奨します。
