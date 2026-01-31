-- Grafana webhook alerts table
CREATE TABLE IF NOT EXISTS grafana_alerts (
  id TEXT PRIMARY KEY,
  data_source_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  host TEXT,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  received_at INTEGER NOT NULL,
  source_url TEXT,
  labels_json TEXT,
  FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grafana_alerts_data_source ON grafana_alerts(data_source_id);
CREATE INDEX IF NOT EXISTS idx_grafana_alerts_status ON grafana_alerts(status);
CREATE INDEX IF NOT EXISTS idx_grafana_alerts_received_at ON grafana_alerts(received_at);
