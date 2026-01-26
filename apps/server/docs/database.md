# Database Schema

Shumoku Server uses SQLite (via `bun:sqlite`) for persistent storage. The database file is stored at `{dataDir}/shumoku.db`.

## Overview

```
┌─────────────────┐     ┌─────────────────────────┐     ┌─────────────────┐
│  data_sources   │     │  topology_data_sources  │     │   topologies    │
│─────────────────│     │─────────────────────────│     │─────────────────│
│ id (PK)         │◄────│ data_source_id (FK)     │     │ id (PK)         │
│ name            │     │ topology_id (FK)        │────►│ name            │
│ type            │     │ purpose                 │     │ content_json    │
│ config_json     │     │ sync_mode               │     │ mapping_json    │
│ status          │     │ ...                     │     │ ...             │
│ ...             │     └─────────────────────────┘     └─────────────────┘
└─────────────────┘
                                                        ┌─────────────────┐
                                                        │   dashboards    │
                                                        │─────────────────│
                                                        │ id (PK)         │
                                                        │ name            │
                                                        │ layout_json     │
                                                        └─────────────────┘

                                                        ┌─────────────────┐
                                                        │    settings     │
                                                        │─────────────────│
                                                        │ key (PK)        │
                                                        │ value           │
                                                        └─────────────────┘

                                                        ┌─────────────────┐
                                                        │   migrations    │
                                                        │─────────────────│
                                                        │ id (PK)         │
                                                        │ name (UNIQUE)   │
                                                        │ applied_at      │
                                                        └─────────────────┘
```

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

Network topology definitions with optional metrics mapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Topology name |
| `content_json` | TEXT | Multi-file YAML content (see below) |
| `topology_source_id` | TEXT (FK) | Data source for topology sync (optional) |
| `metrics_source_id` | TEXT (FK) | Data source for metrics (optional) |
| `mapping_json` | TEXT | Node/Link to monitoring host mapping (JSON) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

**content_json format:**

```json
{
  "files": [
    { "name": "main.yaml", "content": "name: My Network\nnodes:\n  - id: router1\n..." },
    { "name": "campus.yaml", "content": "name: Campus\nnodes:\n..." }
  ]
}
```

**mapping_json format (ZabbixMapping):**

```json
{
  "nodes": {
    "router1": { "hostId": "prometheus-hostname-or-zabbix-hostid" },
    "switch1": { "hostId": "switch1.example.com" }
  },
  "links": {
    "link-0": {
      "monitoredNodeId": "router1",
      "interface": "ge-0/0/1",
      "capacity": 1000000000
    }
  }
}
```

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
| `priority` | INTEGER | Priority order (higher = preferred) |
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
| `idx_topologies_topology_source` | topologies | topology_source_id |
| `idx_topologies_metrics_source` | topologies | metrics_source_id |
| `idx_topologies_name` | topologies | name |
| `idx_data_sources_name` | data_sources | name |
| `idx_data_sources_type` | data_sources | type |
| `idx_topology_data_sources_topology` | topology_data_sources | topology_id |
| `idx_topology_data_sources_source` | topology_data_sources | data_source_id |

## Migrations

Schema migrations use numbered SQL files in `src/db/migrations/`. On startup, the server automatically applies any pending migrations.

| File | Description |
|------|-------------|
| `001_initial.sql` | Initial schema (tables, indexes) |
| `002_health_check.sql` | Health check status fields for data_sources |
| `003_topology_data_sources.sql` | Junction table for many-to-many relationships |

**Adding a new migration:**

1. Create `src/db/migrations/NNN_description.sql` (increment number)
2. Write SQL statements (CREATE TABLE, ALTER TABLE, etc.)
3. Restart server - migration applies automatically

**Note:** Migrations are tracked in the `migrations` table, not `settings`.

## TypeScript Interfaces

See `apps/server/src/types.ts` for corresponding TypeScript interfaces:

- `DataSource` - data_sources table
- `Topology` - topologies table
- `TopologyDataSource` - topology_data_sources table
- `Dashboard` - dashboards table
- `ZabbixMapping` - mapping_json structure

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
