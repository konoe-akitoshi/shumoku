-- Initial schema
-- Creates core tables for Shumoku server

-- Data sources table (original schema without plugin fields)
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'zabbix',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Topologies table
CREATE TABLE IF NOT EXISTS topologies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content_json TEXT NOT NULL,
  topology_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
  metrics_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
  mapping_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topologies_topology_source ON topologies(topology_source_id);
CREATE INDEX IF NOT EXISTS idx_topologies_metrics_source ON topologies(metrics_source_id);
CREATE INDEX IF NOT EXISTS idx_topologies_name ON topologies(name);
CREATE INDEX IF NOT EXISTS idx_data_sources_name ON data_sources(name);
CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
