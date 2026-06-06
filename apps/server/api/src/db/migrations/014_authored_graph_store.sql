-- Move the Manual source's authored graph out of `data_sources.config_json.graph`
-- into its own table. The authored graph is *content*, not connection *config*;
-- migration 011 stashed it in config_json as an interim home. Give it a real
-- store keyed by the Manual source id (so it can be shared across topologies).
--
-- See issue #361 / apps/server/docs/design/topology-composition-store.md § Phase 4.

CREATE TABLE IF NOT EXISTS manual_source_graph (
  source_id  TEXT PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
  graph_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Backfill: copy config_json.graph → the table for every Manual source that has one.
INSERT OR IGNORE INTO manual_source_graph (source_id, graph_json, updated_at)
SELECT id, json_extract(config_json, '$.graph'), updated_at
FROM data_sources
WHERE type = 'manual' AND json_extract(config_json, '$.graph') IS NOT NULL;

-- Strip the graph key from config_json — content no longer lives in config.
UPDATE data_sources
SET config_json = json_remove(config_json, '$.graph')
WHERE type = 'manual' AND json_extract(config_json, '$.graph') IS NOT NULL;
