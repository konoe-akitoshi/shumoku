/**
 * Database Schema
 * Table definitions and initialization for SQLite
 */

import type { Database } from 'bun:sqlite'

/**
 * Initialize database schema
 * Creates all required tables if they don't exist
 */
export function initializeSchema(db: Database): void {
  db.exec(`
    -- Data sources (plugin-based, stores connection info for various providers)
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'zabbix',
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Topologies (content_json stores multi-file JSON: {"files": [{name, content}, ...]})
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

    -- Dashboards
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_topologies_topology_source ON topologies(topology_source_id);
    CREATE INDEX IF NOT EXISTS idx_topologies_metrics_source ON topologies(metrics_source_id);
    CREATE INDEX IF NOT EXISTS idx_topologies_name ON topologies(name);
    CREATE INDEX IF NOT EXISTS idx_data_sources_name ON data_sources(name);
    CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
  `)
}

/**
 * Run database migrations
 * Handles schema updates for existing databases
 */
export function runMigrations(db: Database): void {
  // Get current schema version
  const versionResult = db.query("SELECT value FROM settings WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined
  const currentVersion = versionResult ? Number.parseInt(versionResult.value, 10) : 0

  // Apply migrations
  if (currentVersion < 1) {
    // Initial schema - already created in initializeSchema
    db.query("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '1')").run()
  }

  // Migration 2: Plugin architecture support
  if (currentVersion < 2) {
    // Check if old columns exist and migrate
    const tableInfo = db.query('PRAGMA table_info(data_sources)').all() as { name: string }[]
    const hasOldColumns = tableInfo.some((col) => col.name === 'url')

    if (hasOldColumns) {
      // Migrate old data_sources to new format
      db.exec(`
        -- Add config_json column if not exists
        ALTER TABLE data_sources ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}';
      `)

      // Migrate existing data
      const oldSources = db
        .query('SELECT id, url, token, poll_interval FROM data_sources')
        .all() as {
        id: string
        url: string
        token: string
        poll_interval: number
      }[]

      for (const source of oldSources) {
        const config = JSON.stringify({
          url: source.url,
          token: source.token,
          pollInterval: source.poll_interval,
        })
        db.query('UPDATE data_sources SET config_json = ? WHERE id = ?').run(config, source.id)
      }
    }

    // Check if topologies needs migration
    const topoInfo = db.query('PRAGMA table_info(topologies)').all() as { name: string }[]
    const hasOldDataSourceId = topoInfo.some((col) => col.name === 'data_source_id')
    const hasNewMetricsSourceId = topoInfo.some((col) => col.name === 'metrics_source_id')

    if (hasOldDataSourceId && !hasNewMetricsSourceId) {
      db.exec(`
        ALTER TABLE topologies ADD COLUMN topology_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL;
        ALTER TABLE topologies ADD COLUMN metrics_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL;
      `)
      // Copy data_source_id to metrics_source_id
      db.exec('UPDATE topologies SET metrics_source_id = data_source_id')
    }

    db.query("UPDATE settings SET value = '2' WHERE key = 'schema_version'").run()
    console.log('[Database] Migration 2: Plugin architecture support applied')
  }
}
