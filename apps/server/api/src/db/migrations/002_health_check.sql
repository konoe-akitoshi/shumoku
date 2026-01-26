-- Health check status fields for data sources

ALTER TABLE data_sources ADD COLUMN status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE data_sources ADD COLUMN status_message TEXT;
ALTER TABLE data_sources ADD COLUMN last_checked_at INTEGER;
ALTER TABLE data_sources ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0;
