// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * SNMP Credentials Service — CRUD over the `snmp_credentials` table.
 *
 * Why these live in their own table (not on `data_sources`): one
 * network typically uses multiple communities (production gear,
 * legacy gear, acquired networks). Pre-credentials the workaround
 * was "create one SNMP-LLDP data source per community"; that works
 * but conflates "where data comes from" with "which secret to use".
 * Credentials lifted out lets per-node / per-subgraph overrides ride
 * the discovery-policy inheritance chain — same pattern Scanopy uses.
 *
 * Storage: community as a literal string. Same convention as the
 * other secrets in `data_sources.config_json` — masked in API
 * responses but not encrypted at rest. True at-rest encryption is
 * tracked separately and is not strictly necessary for the single-
 * tenant lab deployment Shumoku targets today.
 */

import type { Database } from 'bun:sqlite'
import { generateId, getDatabase, timestamp } from '../db/index.js'

export interface SnmpCredential {
  id: string
  name: string
  community: string
  createdAt: number
  updatedAt: number
}

export interface SnmpCredentialInput {
  name: string
  community: string
}

interface SnmpCredentialRow {
  id: string
  name: string
  community: string
  created_at: number
  updated_at: number
}

function rowToCredential(row: SnmpCredentialRow): SnmpCredential {
  return {
    id: row.id,
    name: row.name,
    community: row.community,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SnmpCredentialsService {
  private db: Database
  constructor() {
    this.db = getDatabase()
  }

  list(): SnmpCredential[] {
    const rows = this.db
      .query('SELECT * FROM snmp_credentials ORDER BY name')
      .all() as SnmpCredentialRow[]
    return rows.map(rowToCredential)
  }

  get(id: string): SnmpCredential | null {
    const row = this.db.query('SELECT * FROM snmp_credentials WHERE id = ?').get(id) as
      | SnmpCredentialRow
      | undefined
    return row ? rowToCredential(row) : null
  }

  /** Resolve many credentials at once — used by sync/scheduler to
   *  build the per-target community map without round-tripping the
   *  DB once per node. Returns a map keyed by id; missing ids are
   *  silently absent (caller decides whether to surface as an error). */
  getMany(ids: readonly string[]): Map<string, SnmpCredential> {
    const out = new Map<string, SnmpCredential>()
    if (ids.length === 0) return out
    // SQLite has no first-class `IN (?,?,?)` parameter array; build
    // the placeholder list manually. ids come from server-validated
    // policy state, not user input.
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.db
      .query(`SELECT * FROM snmp_credentials WHERE id IN (${placeholders})`)
      .all(...ids) as SnmpCredentialRow[]
    for (const r of rows) out.set(r.id, rowToCredential(r))
    return out
  }

  async create(input: SnmpCredentialInput): Promise<SnmpCredential> {
    const id = await generateId()
    const now = timestamp()
    this.db
      .query(
        `INSERT INTO snmp_credentials (id, name, community, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, input.name, input.community, now, now)
    const created = this.get(id)
    if (!created) throw new Error('SNMP credential insert succeeded but row missing on read-back')
    return created
  }

  update(id: string, input: Partial<SnmpCredentialInput>): SnmpCredential | null {
    const existing = this.get(id)
    if (!existing) return null
    const updates: string[] = []
    const values: (string | number)[] = []
    if (input.name !== undefined) {
      updates.push('name = ?')
      values.push(input.name)
    }
    if (input.community !== undefined) {
      updates.push('community = ?')
      values.push(input.community)
    }
    if (updates.length === 0) return existing
    updates.push('updated_at = ?')
    values.push(timestamp())
    values.push(id)
    this.db.query(`UPDATE snmp_credentials SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  delete(id: string): boolean {
    const result = this.db.query('DELETE FROM snmp_credentials WHERE id = ?').run(id)
    return result.changes > 0
  }
}
