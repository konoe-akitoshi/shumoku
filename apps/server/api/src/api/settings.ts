/**
 * Settings API
 * Key-value settings storage
 */

import { Hono } from 'hono'
import { getDatabase } from '../db/index.js'

const PROTECTED_KEYS = new Set(['auth_password_hash'])

interface SettingRow {
  key: string
  value: string
}

export function createSettingsApi(): Hono {
  const app = new Hono()

  // Get all settings
  app.get('/', (c) => {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM settings').all() as SettingRow[]
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return c.json(settings)
  })

  // Get single setting
  app.get('/:key', (c) => {
    const key = c.req.param('key')
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | SettingRow
      | undefined
    if (!row) {
      return c.json({ error: 'Setting not found' }, 404)
    }
    return c.json({ key, value: row.value })
  })

  // Update settings (bulk)
  app.put('/', async (c) => {
    try {
      const body = (await c.req.json()) as Record<string, string>
      const db = getDatabase()
      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

      const updateMany = db.transaction((items: [string, string][]) => {
        for (const [key, value] of items) {
          upsert.run(key, value)
        }
      })

      const entries = Object.entries(body)
      for (const [key] of entries) {
        if (PROTECTED_KEYS.has(key)) {
          return c.json({ error: 'Cannot modify protected setting' }, 403)
        }
      }

      updateMany(entries)
      return c.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update single setting
  app.put('/:key', async (c) => {
    const key = c.req.param('key')

    if (PROTECTED_KEYS.has(key)) {
      return c.json({ error: 'Cannot modify protected setting' }, 403)
    }

    try {
      const body = (await c.req.json()) as { value: string }
      if (body.value === undefined) {
        return c.json({ error: 'value is required' }, 400)
      }

      const db = getDatabase()
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, body.value)
      return c.json({ key, value: body.value })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Delete setting
  app.delete('/:key', (c) => {
    const key = c.req.param('key')
    const db = getDatabase()
    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    if (result.changes === 0) {
      return c.json({ error: 'Setting not found' }, 404)
    }
    return c.json({ success: true })
  })

  return app
}
