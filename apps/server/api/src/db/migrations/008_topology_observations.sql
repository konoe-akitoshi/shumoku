-- Topology observation model (foundation v1)
--
-- Each row holds one source's NetworkGraph snapshot at a point in time.
-- The resolver folds these (and the authored layer in `topologies.content_json`)
-- into the displayed graph. See
-- `apps/server/docs/design/topology-foundation-schema.md § 2.1`.

CREATE TABLE IF NOT EXISTS topology_observations (
  id TEXT PRIMARY KEY,
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Scan start / capture timestamp (Unix ms)
  captured_at INTEGER NOT NULL,

  -- 'ok' | 'partial' | 'failed' | 'empty'
  --   ok      : snapshot is authoritative for presence and absence
  --   partial : presence trusted, absence not (timeouts, scope cuts)
  --   failed  : ignore entirely; do not retract anything
  --   empty   : succeeded but found nothing; do not retract
  status TEXT NOT NULL,

  -- Optional human-readable message for status != 'ok'
  status_message TEXT,

  -- Serialized NetworkGraph. NULL when status='failed'.
  graph_json TEXT,

  -- Aggregate counters for UI / debug
  node_count INTEGER NOT NULL DEFAULT 0,
  link_count INTEGER NOT NULL DEFAULT 0,
  port_count INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topology_observations_topology_source
  ON topology_observations(topology_id, source_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_topology_observations_captured_at
  ON topology_observations(captured_at);

-- Track retraction hysteresis per (topology, source) pair.
ALTER TABLE topology_data_sources ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topology_data_sources ADD COLUMN last_ok_captured_at INTEGER;

-- Note: legacy columns to be dropped in a follow-up migration once the
-- topology service is refactored to consume topology_observations
-- exclusively. See topology-foundation-schema.md § 2.2 / § 2.3:
--   - topology_data_sources.priority           (merge no longer uses it)
--   - topologies.topology_source_id           (legacy single-source pointer)
--   - topologies.metrics_source_id            (legacy single-source pointer)
