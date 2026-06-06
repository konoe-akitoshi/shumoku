-- Make Manual a uniform data source: its authored graph becomes a per-topology
-- `topology_observations` snapshot, like every other source — reversing
-- migration 011 (which parked it in `config_json.graph`) and restoring the shape
-- of migration 010. The editor's save then records observations like a sync.
--
-- See apps/server/docs/design/manual-source-unification.md (#368). No-backcompat:
-- the source-level content-mirror sharing 011 added is dropped (it was unused —
-- each topology already owns its Manual source).

-- 1. Move each Manual source's config_json.graph → a fresh observation per
--    attached topology. `json_valid` guards against malformed config (the
--    migration runner is not transactional). INSERT OR IGNORE = idempotent
--    (derived id is unique per topology; 011 already deleted old manual obs).
INSERT OR IGNORE INTO topology_observations
  (id, topology_id, source_id, captured_at, status, graph_json,
   node_count, link_count, port_count, created_at)
SELECT
  'obs_man_' || tds.topology_id,
  tds.topology_id,
  ds.id,
  ds.updated_at,
  'ok',
  json_extract(ds.config_json, '$.graph'),
  COALESCE(json_array_length(ds.config_json, '$.graph.nodes'), 0),
  COALESCE(json_array_length(ds.config_json, '$.graph.links'), 0),
  0,
  ds.updated_at
FROM data_sources ds
JOIN topology_data_sources tds
  ON tds.data_source_id = ds.id AND tds.purpose = 'topology'
WHERE ds.type = 'manual'
  AND json_valid(ds.config_json)
  AND json_extract(ds.config_json, '$.graph') IS NOT NULL;

-- 2. Strip the graph from config — content no longer lives in config.
UPDATE data_sources
SET config_json = json_remove(config_json, '$.graph')
WHERE type = 'manual'
  AND json_valid(config_json)
  AND json_extract(config_json, '$.graph') IS NOT NULL;
