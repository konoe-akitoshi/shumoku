/**
 * Database Connection
 * SQLite connection management using bun:sqlite
 */

import { Database } from 'bun:sqlite'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getMigrationStatus, runMigrations } from './schema.js'

export { getMigrationStatus }

let db: Database | null = null

/**
 * Get the database instance
 * Creates and initializes if not already done
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Initialize the database connection
 * @param dataDir - Directory to store the database file
 */
export function initDatabase(dataDir: string = '/data'): Database {
  if (db) {
    return db
  }

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = path.join(dataDir, 'shumoku.db')
  console.log(`[Database] Opening database at: ${dbPath}`)

  db = new Database(dbPath)

  // Connection-level tuning. journal_mode + page_size persist in the file; the
  // rest are per-connection and must be set on every open. We use a single
  // shared connection (getDatabase singleton), so setting them here covers the
  // whole app. Values follow the standard SQLite production set.
  // See apps/server/docs/design/db-native-persistence.md § Performance.

  // WAL: one writer + many concurrent readers (the discovery scheduler writes
  // while the UI reads). Persists in the file.
  db.exec('PRAGMA journal_mode = WAL')
  // With WAL, NORMAL is the safe + faster choice (atomic, never corrupts; only a
  // tiny window of last-commit loss on power loss). Default FULL fsyncs every commit.
  db.exec('PRAGMA synchronous = NORMAL')
  // Foreign-key enforcement (SQLite disables it by default).
  db.exec('PRAGMA foreign_keys = ON')
  // Wait up to 5s for a lock instead of throwing SQLITE_BUSY immediately — the
  // scheduler-writes-while-UI-reads collision would otherwise surface as errors.
  db.exec('PRAGMA busy_timeout = 5000')
  // 64 MiB page cache (negative = KiB). Default is ~2 MiB.
  db.exec('PRAGMA cache_size = -65536')
  // Build temp B-trees (sorts, etc.) in RAM rather than on disk.
  db.exec('PRAGMA temp_store = MEMORY')
  // Memory-map up to 256 MiB of the DB file → fewer read syscalls.
  db.exec('PRAGMA mmap_size = 268435456')

  // Run migrations (creates tables and applies updates)
  runMigrations(db)

  console.log('[Database] Initialized successfully')

  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    // Let SQLite refresh query-planner stats for indexes it has seen this run
    // (cheap; no-op when nothing needs updating).
    try {
      db.exec('PRAGMA optimize')
    } catch {
      // Best-effort — never block shutdown on stats.
    }
    db.close()
    db = null
    console.log('[Database] Connection closed')
  }
}

/**
 * Generate a unique ID
 */
export async function generateId(): Promise<string> {
  const { nanoid } = await import('nanoid')
  return nanoid(12)
}

/**
 * Get current timestamp in milliseconds
 */
export function timestamp(): number {
  return Date.now()
}
