-- Topology-DataSource junction table (many-to-many with config)

CREATE TABLE IF NOT EXISTS topology_data_sources (
  id TEXT PRIMARY KEY,
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  data_source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, -- 'topology' or 'metrics'
  sync_mode TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'on_view', 'webhook'
  webhook_secret TEXT,
  last_synced_at INTEGER,
  priority INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(topology_id, data_source_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_topology_data_sources_topology ON topology_data_sources(topology_id);
CREATE INDEX IF NOT EXISTS idx_topology_data_sources_source ON topology_data_sources(data_source_id);
