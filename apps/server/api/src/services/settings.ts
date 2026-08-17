import type { Database } from 'bun:sqlite'
import { getDatabase } from '../db/index.js'

interface SettingRow {
  key: string
  value: string
}

export class SettingsService {
  private readonly db: Database

  constructor(db: Database = getDatabase()) {
    this.db = db
  }

  list(): Record<string, string> {
    const settings: Record<string, string> = {}
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as SettingRow[]
    for (const row of rows) settings[row.key] = row.value
    return settings
  }

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | Pick<SettingRow, 'value'>
      | undefined
    return row?.value ?? null
  }

  setMany(settings: Record<string, string>): void {
    const upsert = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    this.db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) upsert.run(key, value)
    })(Object.entries(settings))
  }

  set(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  }

  delete(key: string): boolean {
    return this.db.prepare('DELETE FROM settings WHERE key = ?').run(key).changes > 0
  }
}
