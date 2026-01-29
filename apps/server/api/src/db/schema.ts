/**
 * Database Migration System
 * SQL migrations are imported as strings via esbuild text loader,
 * so they are embedded in the bundle and work in both dev and Docker.
 */

import type { Database } from 'bun:sqlite'

// Import migration SQL files (esbuild text loader embeds them as strings)
import migration001 from './migrations/001_initial.sql'
import migration002 from './migrations/002_health_check.sql'
import migration003 from './migrations/003_topology_data_sources.sql'
import migration004 from './migrations/004_topology_source_options.sql'

/** Ordered list of all migrations */
const MIGRATIONS: { name: string; sql: string }[] = [
  { name: '001_initial.sql', sql: migration001 },
  { name: '002_health_check.sql', sql: migration002 },
  { name: '003_topology_data_sources.sql', sql: migration003 },
  { name: '004_topology_source_options.sql', sql: migration004 },
]

interface MigrationRecord {
  id: number
  name: string
  applied_at: number
}

/**
 * Initialize migration tracking table
 */
function initMigrationTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `)
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(db: Database): Set<string> {
  const rows = db.query('SELECT name FROM migrations').all() as { name: string }[]
  return new Set(rows.map((r) => r.name))
}

/**
 * Migrate from old schema_version system to new migrations table
 * Maps old version numbers to migration files
 */
function migrateFromSchemaVersion(db: Database): void {
  // Check if settings table exists (old system)
  const tableExists = db
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
    .get()

  if (!tableExists) {
    return // Fresh database, no old system
  }

  // Check if old schema_version exists
  const versionResult = db.query("SELECT value FROM settings WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined

  if (!versionResult) {
    return // No old system or already migrated
  }

  const oldVersion = Number.parseInt(versionResult.value, 10)
  console.log(`[Migration] Migrating from schema_version ${oldVersion} to file-based system`)

  // Map old versions to migration files
  const versionToMigration: Record<number, string[]> = {
    1: ['001_initial.sql'],
    2: ['001_initial.sql'],
    3: ['001_initial.sql', '002_health_check.sql'],
  }

  const appliedMigrations = versionToMigration[oldVersion] || ['001_initial.sql']

  // Mark these migrations as already applied
  const now = Date.now()
  for (const migration of appliedMigrations) {
    db.query('INSERT OR IGNORE INTO migrations (name, applied_at) VALUES (?, ?)').run(
      migration,
      now,
    )
  }

  // Remove old schema_version
  db.query("DELETE FROM settings WHERE key = 'schema_version'").run()

  console.log(`[Migration] Marked ${appliedMigrations.length} migrations as applied`)
}

/**
 * Execute SQL from a migration string
 */
function applyMigration(db: Database, name: string, sql: string): void {
  // Remove comment lines and split by semicolons
  const cleanedSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')

  const statements = cleanedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const statement of statements) {
    try {
      db.exec(statement)
    } catch (error) {
      // Ignore "column already exists" errors for idempotency
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        console.log(`[Migration] Skipping (already exists): ${statement.slice(0, 50)}...`)
      } else {
        throw error
      }
    }
  }

  // Record migration as applied
  db.query('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(name, Date.now())
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database): void {
  // Initialize migration tracking table
  initMigrationTable(db)

  // Migrate from old schema_version if needed
  migrateFromSchemaVersion(db)

  // Get applied migrations
  const applied = getAppliedMigrations(db)

  // Find pending migrations
  const pending = MIGRATIONS.filter((m) => !applied.has(m.name))

  if (pending.length === 0) {
    console.log('[Migration] Database is up to date')
    return
  }

  console.log(`[Migration] Applying ${pending.length} migration(s)...`)

  for (const migration of pending) {
    console.log(`[Migration] Applying: ${migration.name}`)
    applyMigration(db, migration.name, migration.sql)
  }

  console.log('[Migration] All migrations applied successfully')
}

/**
 * Get migration status for debugging
 */
export function getMigrationStatus(db: Database): {
  applied: MigrationRecord[]
  pending: string[]
} {
  initMigrationTable(db)

  const applied = db.query('SELECT * FROM migrations ORDER BY id').all() as MigrationRecord[]
  const appliedNames = new Set(applied.map((m) => m.name))
  const pending = MIGRATIONS.filter((m) => !appliedNames.has(m.name)).map((m) => m.name)

  return { applied, pending }
}
