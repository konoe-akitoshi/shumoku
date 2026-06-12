-- Signal streams (design: apps/server/docs/design/signal-streams.md).
-- Append-only, source-attributed, timestamped records are the PRIMARY data;
-- current state (contribution store / resolved artifact) is a projection.
-- This migration adds the metrics and alert streams and the as-of index on
-- the existing topology stream (topology_observations).

-- topology stream: as-of queries walk (topology_id, captured_at DESC)
CREATE INDEX IF NOT EXISTS idx_topology_observations_asof
  ON topology_observations (topology_id, captured_at DESC);

-- metrics stream, layer 1: raw per-tick snapshot for point-in-time
-- weathermap reproduction. One row per poll tick per topology; payload is
-- the full MetricsData JSON, gzip-compressed. Retention ~72h (housekeeping).
CREATE TABLE IF NOT EXISTS metrics_history (
  topology_id TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  payload     BLOB NOT NULL,
  PRIMARY KEY (topology_id, captured_at)
);

-- metrics stream, layer 2: hourly aggregates per entity for sparklines and
-- baseline-deviation coloring. Retention ~400d (housekeeping).
CREATE TABLE IF NOT EXISTS metrics_trends (
  topology_id  TEXT NOT NULL,
  entity_kind  TEXT NOT NULL,            -- 'node' | 'link'
  entity_id    TEXT NOT NULL,
  hour_start   INTEGER NOT NULL,         -- Unix ms, top of hour
  samples      INTEGER NOT NULL,
  util_min     REAL,
  util_avg     REAL,
  util_max     REAL,
  bps_avg      REAL,
  status_worst TEXT,
  PRIMARY KEY (topology_id, entity_kind, entity_id, hour_start)
);
CREATE INDEX IF NOT EXISTS idx_metrics_trends_entity
  ON metrics_trends (topology_id, entity_kind, entity_id, hour_start DESC);

-- alert stream: state TRANSITIONS only (fired / resolved / changed), never
-- overwritten. The current-state view (e.g. grafana_alerts) stays a
-- projection. Retention ~180d (housekeeping).
CREATE TABLE IF NOT EXISTS alert_events (
  id           TEXT PRIMARY KEY,
  topology_id  TEXT,
  source_id    TEXT NOT NULL,
  alert_key    TEXT NOT NULL,
  transition   TEXT NOT NULL,            -- 'fired' | 'resolved' | 'changed'
  severity     TEXT NOT NULL,
  node_id      TEXT,
  at           INTEGER NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_events_key
  ON alert_events (source_id, alert_key, at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_topology
  ON alert_events (topology_id, at DESC);
