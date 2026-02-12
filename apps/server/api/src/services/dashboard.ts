/**
 * Dashboard Service
 * Manages dashboard CRUD operations
 */

import type { Database } from 'bun:sqlite'
import { generateId, getDatabase, timestamp } from '../db/index.js'
import type { Dashboard, DashboardInput } from '../types.js'

interface DashboardRow {
  id: string
  name: string
  layout_json: string
  share_token: string | null
  created_at: number
  updated_at: number
}

function rowToDashboard(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    name: row.name,
    layoutJson: row.layout_json,
    shareToken: row.share_token ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DashboardService {
  private db: Database

  constructor() {
    this.db = getDatabase()
  }

  /**
   * Get all dashboards
   */
  list(): Dashboard[] {
    const rows = this.db
      .query('SELECT * FROM dashboards ORDER BY created_at DESC')
      .all() as DashboardRow[]
    return rows.map(rowToDashboard)
  }

  /**
   * Get a single dashboard by ID
   */
  get(id: string): Dashboard | null {
    const row = this.db.query('SELECT * FROM dashboards WHERE id = ?').get(id) as
      | DashboardRow
      | undefined
    return row ? rowToDashboard(row) : null
  }

  /**
   * Create a new dashboard
   */
  async create(input: DashboardInput): Promise<Dashboard> {
    const id = generateId()
    const now = timestamp()

    this.db
      .query(
        `INSERT INTO dashboards (id, name, layout_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.name, input.layoutJson, now, now)

    return this.get(id)!
  }

  /**
   * Update an existing dashboard
   */
  update(id: string, input: Partial<DashboardInput>): Dashboard | null {
    const existing = this.get(id)
    if (!existing) {
      return null
    }

    const updates: string[] = []
    const values: (string | number)[] = []

    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.layoutJson !== undefined) {
      updates.push('layout_json = ?')
      values.push(input.layoutJson)
    }

    if (updates.length === 0) {
      return existing
    }

    updates.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)

    this.db.query(`UPDATE dashboards SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return this.get(id)
  }

  /**
   * Delete a dashboard
   */
  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM dashboards WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Enable sharing by generating a token
   */
  async share(id: string): Promise<string | null> {
    const existing = this.get(id)
    if (!existing) return null

    const { nanoid } = await import('nanoid')
    const token = nanoid(24)
    this.db
      .query('UPDATE dashboards SET share_token = ?, updated_at = ? WHERE id = ?')
      .run(token, timestamp(), id)
    return token
  }

  /**
   * Disable sharing by clearing the token
   */
  unshare(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false

    this.db
      .query('UPDATE dashboards SET share_token = NULL, updated_at = ? WHERE id = ?')
      .run(timestamp(), id)
    return true
  }

  /**
   * Get a dashboard by its share token
   */
  getByShareToken(token: string): Dashboard | null {
    const row = this.db.query('SELECT * FROM dashboards WHERE share_token = ?').get(token) as
      | DashboardRow
      | undefined
    return row ? rowToDashboard(row) : null
  }
}
