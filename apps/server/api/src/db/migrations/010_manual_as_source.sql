-- Move editor-authored content from `topologies.content_json` into the
-- observation model as snapshots of a per-topology Manual data source.
--
-- After this migration:
--   - Every existing topology owns a `data_sources` row of type='manual'
--   - The Manual row is attached via `topology_data_sources` (purpose='topology')
--   - The previous content_json lives as the first `topology_observations` row
--   - `topologies.content_json` is gone — editor save = record a new observation
--
-- IDs are derived (`man_<topology_id>`) so the migration is idempotent and
-- so the relationship is debuggable. New Manual sources created after this
-- migration use the standard generateId() (no `man_` prefix); the prefix
-- is only a historical marker for migrated rows.

-- 1. Create one Manual data_source per topology
INSERT OR IGNORE INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
SELECT
  'man_' || id,
  'Manual',
  'manual',
  '{}',
  'connected',
  0,
  created_at,
  updated_at
FROM topologies;

-- 2. Attach Manual to its topology (purpose='topology')
INSERT OR IGNORE INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, created_at, updated_at)
SELECT
  'tds_man_' || id,
  id,
  'man_' || id,
  'topology',
  'manual',
  created_at,
  updated_at
FROM topologies;

-- 3. Record the existing content_json as the Manual source 's first observation
INSERT OR IGNORE INTO topology_observations (id, topology_id, source_id, captured_at, status, graph_json, node_count, link_count, port_count, created_at)
SELECT
  'obs_man_' || id,
  id,
  'man_' || id,
  updated_at,
  'ok',
  content_json,
  COALESCE(json_array_length(content_json, '$.nodes'), 0),
  COALESCE(json_array_length(content_json, '$.links'), 0),
  0,
  updated_at
FROM topologies
WHERE content_json IS NOT NULL AND content_json != '';

-- 4. Drop the column. SQLite 3.35+ supports DROP COLUMN; Bun 's bundled
--    SQLite is well past that.
ALTER TABLE topologies DROP COLUMN content_json;
