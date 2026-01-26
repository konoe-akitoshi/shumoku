/**
 * Database Migration System
 * File-based SQL migrations for SQLite
 */

import type { Database } from 'bun:sqlite'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

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
 * Get migration files from directory, sorted by number
 */
function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return []
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => {
      // Sort by leading number (001, 002, etc.)
      const numA = Number.parseInt(a.split('_')[0], 10)
      const numB = Number.parseInt(b.split('_')[0], 10)
      return numA - numB
    })
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
  // Version 1 = initial schema (001)
  // Version 2 = plugin architecture (rolled into 001 for new DBs)
  // Version 3 = health check (002)
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
 * Apply a single migration file
 */
function applyMigration(db: Database, fileName: string): void {
  const filePath = path.join(MIGRATIONS_DIR, fileName)
  const sql = fs.readFileSync(filePath, 'utf-8')

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
  db.query('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(fileName, Date.now())
}

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database): void {
  // Initialize migration tracking table
  initMigrationTable(db)

  // Migrate from old schema_version if needed
  migrateFromSchemaVersion(db)

  // Get applied and available migrations
  const applied = getAppliedMigrations(db)
  const available = getMigrationFiles()

  // Find pending migrations
  const pending = available.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    console.log('[Migration] Database is up to date')
    return
  }

  console.log(`[Migration] Applying ${pending.length} migration(s)...`)

  // Apply each pending migration
  for (const migration of pending) {
    console.log(`[Migration] Applying: ${migration}`)
    applyMigration(db, migration)
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
  const available = getMigrationFiles()
  const pending = available.filter((f) => !appliedNames.has(f))

  return { applied, pending }
}
