/**
 * Database Connection
 * SQLite connection management using bun:sqlite
 */

import { Database } from 'bun:sqlite'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { runMigrations, getMigrationStatus } from './schema.js'

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

  // Enable WAL mode for better concurrent access
  db.exec('PRAGMA journal_mode = WAL')

  // Enable foreign key enforcement (SQLite disables by default)
  db.exec('PRAGMA foreign_keys = ON')

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
