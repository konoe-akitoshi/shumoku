// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Credentials — the server-wide secrets Shumoku reads devices with.
 *
 * A credential (an SNMP community, today) is a fact about the network, so it
 * is stored once and rotated once. It is only ever TRIED on a topology that
 * links it (`topology_credential`): one server may host separate networks, and
 * one site's community must not be sprayed at another site's devices.
 *
 * Secrets are an admin surface. Everything that lists or counts selects
 * `secret_json` never; only the trial / read / test paths load it, through
 * `loadCredentialParams` and `credentialsForTrial`.
 */

import { nanoid } from 'nanoid'
import { getDatabase, timestamp } from '../db/index.js'
import {
  type AccessMethod,
  type CredentialParams,
  getAccessMethod,
  normalizeParams,
  sameParams,
  splitParams,
} from './access-methods.js'

export type ReadStatus = 'ok' | 'partial' | 'failed'

/** How many devices use a credential, by how their last read went. */
export interface CredentialUsage {
  ok: number
  partial: number
  failed: number
  /** Assigned but never read. */
  pending: number
}

/** A credential as a topology's own screen shows it: only what that topology links. */
export interface CredentialView {
  id: string
  name: string
  method: string
  /** Non-secret parameter values. */
  params: CredentialParams
  /** Keys of the secret fields that hold a value. */
  secretsSet: string[]
  usage: CredentialUsage
  /** The latest clean read made with it in this topology. */
  lastOkAt?: number
}

export interface CredentialTopologyUse {
  id: string
  name: string
  usage: CredentialUsage
  /** Devices of that topology with no credential that every credential was tried on. */
  silent: number
}

/** A credential as the administrator sees it: every topology that uses it. */
export interface CredentialAdminView {
  id: string
  name: string
  method: string
  params: CredentialParams
  secretsSet: string[]
  createdAt: number
  updatedAt: number
  secretChangedAt: number
  topologies: CredentialTopologyUse[]
}

export interface CredentialEffect {
  topologyId: string
  name: string
  /** Devices using the credential there. */
  devices: number
  /** Silent devices there that become retry-eligible. */
  retrySilent: number
}

type Failure<S extends number> = { error: string; status: S }

interface CredentialListRow {
  id: string
  name: string
  method: string
  params_json: string
  secrets_set: string | null
  secret_changed_at: number
  created_at: number
  updated_at: number
}

// `secret_json` is deliberately absent: which secrets hold a value is computed
// inside SQL, so a listing never reads the secret itself.
const LIST_SELECT = `SELECT id, name, method, params_json, secret_changed_at, created_at, updated_at,
  (SELECT json_group_array(key) FROM json_each(credential.secret_json)
    WHERE value IS NOT NULL AND value != '') AS secrets_set
  FROM credential`

function parseParams(json: string | null): CredentialParams {
  if (!json) return {}
  try {
    const value: unknown = JSON.parse(json)
    if (!value || typeof value !== 'object') return {}
    const out: CredentialParams = {}
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string') out[key] = v
    }
    return out
  } catch {
    return {}
  }
}

function parseKeys(json: string | null): string[] {
  if (!json) return []
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function emptyUsage(): CredentialUsage {
  return { ok: 0, partial: 0, failed: 0, pending: 0 }
}

function addUsage(usage: CredentialUsage, status: string | null, n: number): void {
  if (status === 'ok') usage.ok += n
  else if (status === 'partial') usage.partial += n
  else if (status === 'failed') usage.failed += n
  else usage.pending += n
}

// ── Retry clock ─────────────────────────────────────────────────────────────

/**
 * When a topology's credentials last changed in a way that makes a silent
 * device worth trying again: the latest secret change among the credentials it
 * links, or the latest link added. A rename and a removed link do not move it.
 * 0 when it links nothing.
 */
export function topologyClock(topologyId: string): number {
  const row = getDatabase()
    .query(
      `SELECT MAX(
         COALESCE((SELECT MAX(c.secret_changed_at)
                     FROM topology_credential tc JOIN credential c ON c.id = tc.credential_id
                    WHERE tc.topology_id = ?), 0),
         COALESCE((SELECT MAX(added_at) FROM topology_credential WHERE topology_id = ?), 0)
       ) AS t`,
    )
    .get(topologyId, topologyId) as { t: number | null } | null
  return row?.t ?? 0
}

/** Devices with no credential that every linked credential was tried on since the clock last moved. */
export function silentCount(topologyId: string, clock = topologyClock(topologyId)): number {
  const row = getDatabase()
    .query(
      `SELECT COUNT(*) AS n FROM device_access
        WHERE topology_id = ? AND credential_id IS NULL AND enabled = 1
          AND tried_at IS NOT NULL AND tried_at >= ?`,
    )
    .get(topologyId, clock) as { n: number }
  return row.n
}

// ── Reading ─────────────────────────────────────────────────────────────────

function topologyExists(id: string): boolean {
  return getDatabase().query('SELECT 1 FROM topologies WHERE id = ?').get(id) !== null
}

function topologyNames(): Map<string, string> {
  const rows = getDatabase().query('SELECT id, name FROM topologies').all() as Array<{
    id: string
    name: string
  }>
  return new Map(rows.map((r) => [r.id, r.name]))
}

/** Is the credential linked to the topology? */
export function isLinked(topologyId: string, credentialId: string): boolean {
  return (
    getDatabase()
      .query('SELECT 1 FROM topology_credential WHERE topology_id = ? AND credential_id = ?')
      .get(topologyId, credentialId) !== null
  )
}

/**
 * The full parameters of a credential, secrets included. Only the trial, read
 * and test paths call this; its result must never reach an API response.
 */
export function loadCredentialParams(
  id: string,
): { method: string; params: CredentialParams } | null {
  const row = getDatabase()
    .query('SELECT method, params_json, secret_json FROM credential WHERE id = ?')
    .get(id) as { method: string; params_json: string; secret_json: string } | null
  if (!row) return null
  return {
    method: row.method,
    params: { ...parseParams(row.params_json), ...parseParams(row.secret_json) },
  }
}

function getListRow(id: string): CredentialListRow | null {
  return getDatabase().query(`${LIST_SELECT} WHERE id = ?`).get(id) as CredentialListRow | null
}

/** Usage counts of device_access rows, keyed by `credentialId` then `topologyId`. */
function usageByCredentialAndTopology(): Map<string, Map<string, CredentialUsage>> {
  const rows = getDatabase()
    .query(
      `SELECT credential_id, topology_id, last_status, COUNT(*) AS n
         FROM device_access WHERE credential_id IS NOT NULL
        GROUP BY credential_id, topology_id, last_status`,
    )
    .all() as Array<{
    credential_id: string
    topology_id: string
    last_status: string | null
    n: number
  }>
  const out = new Map<string, Map<string, CredentialUsage>>()
  for (const r of rows) {
    const perTopology = out.get(r.credential_id) ?? new Map<string, CredentialUsage>()
    const usage = perTopology.get(r.topology_id) ?? emptyUsage()
    addUsage(usage, r.last_status, r.n)
    perTopology.set(r.topology_id, usage)
    out.set(r.credential_id, perTopology)
  }
  return out
}

/** Every credential, with every topology that uses it. Admin only. */
export function listCredentialsAdmin(): CredentialAdminView[] {
  const db = getDatabase()
  const rows = db.query(`${LIST_SELECT} ORDER BY name`).all() as CredentialListRow[]
  const names = topologyNames()
  const links = db
    .query('SELECT credential_id, topology_id FROM topology_credential')
    .all() as Array<{ credential_id: string; topology_id: string }>
  const usage = usageByCredentialAndTopology()
  const silent = new Map<string, number>()
  const silentOf = (topologyId: string): number => {
    const cached = silent.get(topologyId)
    if (cached !== undefined) return cached
    const n = silentCount(topologyId)
    silent.set(topologyId, n)
    return n
  }
  return rows.map((row) => {
    const topologies: CredentialTopologyUse[] = links
      .filter((l) => l.credential_id === row.id)
      .flatMap((l) => {
        const name = names.get(l.topology_id)
        if (name === undefined) return []
        return [
          {
            id: l.topology_id,
            name,
            usage: usage.get(row.id)?.get(l.topology_id) ?? emptyUsage(),
            silent: silentOf(l.topology_id),
          },
        ]
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      id: row.id,
      name: row.name,
      method: row.method,
      params: parseParams(row.params_json),
      secretsSet: parseKeys(row.secrets_set),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      secretChangedAt: row.secret_changed_at,
      topologies,
    }
  })
}

export function getCredentialAdmin(id: string): CredentialAdminView | null {
  return listCredentialsAdmin().find((c) => c.id === id) ?? null
}

/** The credentials a topology links — what its own screen may show. */
export function listCredentialsForTopology(topologyId: string): CredentialView[] {
  const db = getDatabase()
  const rows = db
    .query(
      `${LIST_SELECT} WHERE id IN (SELECT credential_id FROM topology_credential WHERE topology_id = ?)
       ORDER BY name`,
    )
    .all(topologyId) as CredentialListRow[]
  const stats = db
    .query(
      `SELECT credential_id, last_status, COUNT(*) AS n,
              MAX(CASE WHEN last_status = 'ok' THEN last_read_at END) AS last_ok
         FROM device_access WHERE topology_id = ? AND credential_id IS NOT NULL
        GROUP BY credential_id, last_status`,
    )
    .all(topologyId) as Array<{
    credential_id: string
    last_status: string | null
    n: number
    last_ok: number | null
  }>
  return rows.map((row) => {
    const usage = emptyUsage()
    let lastOkAt: number | undefined
    for (const s of stats) {
      if (s.credential_id !== row.id) continue
      addUsage(usage, s.last_status, s.n)
      if (s.last_ok != null) lastOkAt = Math.max(lastOkAt ?? 0, s.last_ok)
    }
    return {
      id: row.id,
      name: row.name,
      method: row.method,
      params: parseParams(row.params_json),
      secretsSet: parseKeys(row.secrets_set),
      usage,
      ...(lastOkAt !== undefined ? { lastOkAt } : {}),
    }
  })
}

// ── Writing ─────────────────────────────────────────────────────────────────

function nameTaken(name: string, exceptId?: string): boolean {
  const row = getDatabase().query('SELECT id FROM credential WHERE name = ?').get(name) as {
    id: string
  } | null
  return row !== null && row.id !== exceptId
}

/** `SNMP 1`, `SNMP 2`, … — the smallest number not yet used. */
function autoName(method: AccessMethod): string {
  let n = 1
  while (nameTaken(`${method.label} ${n}`)) n++
  return `${method.label} ${n}`
}

function unknownTopology(ids: readonly string[]): string | undefined {
  return ids.find((id) => !topologyExists(id))
}

function addLinks(credentialId: string, topologyIds: readonly string[], now: number): string[] {
  const insert = getDatabase().query(
    'INSERT OR IGNORE INTO topology_credential (topology_id, credential_id, added_at) VALUES (?, ?, ?)',
  )
  const added: string[] = []
  for (const topologyId of new Set(topologyIds)) {
    if (insert.run(topologyId, credentialId, now).changes > 0) added.push(topologyId)
  }
  return added
}

/** Rows with nothing to say (no credential, enabled, never read or tried) are not kept. */
export function deleteBlankRows(topologyId: string): void {
  getDatabase()
    .query(
      `DELETE FROM device_access
        WHERE topology_id = ? AND credential_id IS NULL AND enabled = 1
          AND last_read_at IS NULL AND tried_at IS NULL`,
    )
    .run(topologyId)
}

/** Take a credential off every device of a topology that used it. Returns how many. */
function unassignFromTopology(credentialId: string, topologyId: string): number {
  const result = getDatabase()
    .query(
      `UPDATE device_access
          SET credential_id = NULL, assigned_by = NULL, tried_at = NULL, updated_at = ?
        WHERE credential_id = ? AND topology_id = ?`,
    )
    .run(timestamp(), credentialId, topologyId)
  deleteBlankRows(topologyId)
  return result.changes
}

/**
 * Create a credential. When one with identical method and parameters already
 * exists nothing is duplicated: the requested links are added to it instead.
 */
export function createCredential(input: {
  name?: string
  method: string
  params?: Record<string, unknown>
  topologyIds?: readonly string[]
}): { credential: CredentialAdminView; linkedExisting: boolean } | Failure<400 | 404 | 409> {
  const method = getAccessMethod(input.method)
  if (!method) return { error: `unknown access method: ${input.method}`, status: 400 }
  const normalized = normalizeParams(method, input.params)
  if ('error' in normalized) return { error: normalized.error, status: 400 }
  const topologyIds = [...new Set(input.topologyIds ?? [])]
  if (unknownTopology(topologyIds) !== undefined) {
    return { error: 'Topology not found', status: 404 }
  }

  const db = getDatabase()
  const now = timestamp()

  // Identical content (secrets compared here, server-side): link, don't duplicate.
  const sameMethod = db
    .query('SELECT id FROM credential WHERE method = ?')
    .all(method.id) as Array<{
    id: string
  }>
  for (const { id } of sameMethod) {
    const existing = loadCredentialParams(id)
    if (existing && sameParams(method, existing.params, normalized.params)) {
      db.transaction(() => {
        addLinks(id, topologyIds, now)
      })()
      const credential = getCredentialAdmin(id)
      if (credential) return { credential, linkedExisting: true }
    }
  }

  const requested = input.name?.trim() ?? ''
  const name = requested !== '' ? requested : autoName(method)
  if (nameTaken(name)) return { error: `a credential named '${name}' already exists`, status: 409 }

  const id = `cr_${nanoid(12)}`
  const split = splitParams(method, normalized.params)
  db.transaction(() => {
    db.query(
      `INSERT INTO credential (id, name, method, params_json, secret_json, secret_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name,
      method.id,
      JSON.stringify(split.params),
      JSON.stringify(split.secret),
      now,
      now,
      now,
    )
    addLinks(id, topologyIds, now)
  })()
  const credential = getCredentialAdmin(id)
  if (!credential) return { error: 'credential vanished after insert', status: 400 }
  return { credential, linkedExisting: false }
}

function devicesUsing(credentialId: string, topologyId: string): number {
  const row = getDatabase()
    .query('SELECT COUNT(*) AS n FROM device_access WHERE credential_id = ? AND topology_id = ?')
    .get(credentialId, topologyId) as { n: number }
  return row.n
}

/**
 * Rename, change parameters, and/or replace the set of topologies that use
 * it. Omitted or empty secret fields keep their stored value. `topologyIds` is
 * the FULL link set: removing a topology un-assigns the credential from that
 * topology's devices; adding one moves its retry clock.
 */
export function updateCredential(
  id: string,
  patch: { name?: string; params?: Record<string, unknown>; topologyIds?: readonly string[] },
): { credential: CredentialAdminView; effect: CredentialEffect[] } | Failure<400 | 404 | 409> {
  const db = getDatabase()
  const row = getListRow(id)
  const current = loadCredentialParams(id)
  if (!row || !current) return { error: 'credential not found', status: 404 }
  const method = getAccessMethod(row.method)
  if (!method) return { error: `unknown access method: ${row.method}`, status: 400 }

  let name = row.name
  if (patch.name !== undefined) {
    name = patch.name.trim()
    if (name === '') return { error: 'name must not be empty', status: 400 }
    if (nameTaken(name, id))
      return { error: `a credential named '${name}' already exists`, status: 409 }
  }
  const normalized = normalizeParams(method, patch.params, current.params)
  if ('error' in normalized) return { error: normalized.error, status: 400 }
  const valueChanged = !sameParams(method, normalized.params, current.params)

  const linked = (
    db
      .query('SELECT topology_id FROM topology_credential WHERE credential_id = ?')
      .all(id) as Array<{
      topology_id: string
    }>
  ).map((r) => r.topology_id)
  const wanted = patch.topologyIds ? [...new Set(patch.topologyIds)] : linked
  if (unknownTopology(wanted) !== undefined) return { error: 'Topology not found', status: 404 }
  const added = wanted.filter((t) => !linked.includes(t))
  const removed = linked.filter((t) => !wanted.includes(t))

  // Topologies whose devices or retry clock this touches.
  const affected = new Set<string>([...added, ...removed])
  if (valueChanged) for (const t of linked) affected.add(t)
  const before = new Map<string, { devices: number; silent: number }>()
  for (const t of affected) {
    before.set(t, { devices: devicesUsing(id, t), silent: silentCount(t) })
  }

  const now = timestamp()
  const split = splitParams(method, normalized.params)
  db.transaction(() => {
    db.query(
      `UPDATE credential
          SET name = ?, params_json = ?, secret_json = ?, secret_changed_at = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      name,
      JSON.stringify(split.params),
      JSON.stringify(split.secret),
      valueChanged ? now : row.secret_changed_at,
      now,
      id,
    )
    for (const topologyId of removed) {
      unassignFromTopology(id, topologyId)
      db.query('DELETE FROM topology_credential WHERE topology_id = ? AND credential_id = ?').run(
        topologyId,
        id,
      )
    }
    addLinks(id, added, now)
  })()

  const names = topologyNames()
  const effect: CredentialEffect[] = [...affected].flatMap((topologyId) => {
    const was = before.get(topologyId)
    const topologyName = names.get(topologyId)
    if (!was || topologyName === undefined) return []
    return [
      {
        topologyId,
        name: topologyName,
        devices: was.devices,
        retrySilent: Math.max(0, was.silent - silentCount(topologyId)),
      },
    ]
  })
  effect.sort((a, b) => a.name.localeCompare(b.name))
  const credential = getCredentialAdmin(id)
  if (!credential) return { error: 'credential not found', status: 404 }
  return { credential, effect }
}

/** Delete a credential; its devices become un-assigned and its links go with it. */
export function deleteCredential(id: string): { unassigned: number; topologies: number } | null {
  const db = getDatabase()
  if (db.query('SELECT 1 FROM credential WHERE id = ?').get(id) === null) return null
  const topologies = (
    db
      .query('SELECT topology_id FROM topology_credential WHERE credential_id = ?')
      .all(id) as Array<{
      topology_id: string
    }>
  ).map((r) => r.topology_id)
  let unassigned = 0
  db.transaction(() => {
    const deviceTopologies = db
      .query('SELECT DISTINCT topology_id FROM device_access WHERE credential_id = ?')
      .all(id) as Array<{ topology_id: string }>
    for (const { topology_id } of deviceTopologies) {
      unassigned += unassignFromTopology(id, topology_id)
    }
    db.query('DELETE FROM credential WHERE id = ?').run(id)
  })()
  return { unassigned, topologies: topologies.length }
}

// ── Trial ───────────────────────────────────────────────────────────────────

/**
 * The credentials a trial of this topology can use: linked, SNMP, with their
 * community — most-used here first. The credential most devices already answer
 * to is the likeliest for the next one, so most devices cost one probe. Ties
 * break by name. Loads secrets.
 */
export function credentialsForTrial(topologyId: string): Array<{ id: string; community: string }> {
  const rows = getDatabase()
    .query(
      `SELECT c.id, c.name, c.method, c.secret_json,
              (SELECT COUNT(*) FROM device_access d
                WHERE d.topology_id = tc.topology_id AND d.credential_id = c.id) AS n
         FROM topology_credential tc JOIN credential c ON c.id = tc.credential_id
        WHERE tc.topology_id = ?`,
    )
    .all(topologyId) as Array<{
    id: string
    name: string
    method: string
    secret_json: string
    n: number
  }>
  return rows
    .flatMap((r) => {
      const community = r.method === 'snmp' ? parseParams(r.secret_json)['community'] : undefined
      return community ? [{ id: r.id, name: r.name, community, n: r.n }] : []
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .map(({ id, community }) => ({ id, community }))
}

// ── Test sample ─────────────────────────────────────────────────────────────

export interface SampleCandidate {
  entityId: string
  address: string
  /** Currently uses the credential under test. */
  usesCredential: boolean
  /** Has no credential at all. */
  hasNone: boolean
}

export const TEST_SAMPLE_MAX = 10

function addressKey(address: string): number[] {
  return address.split('.').map((p) => Number.parseInt(p, 10) || 0)
}

function compareAddress(a: SampleCandidate, b: SampleCandidate): number {
  const ka = addressKey(a.address)
  const kb = addressKey(b.address)
  for (const [i, x] of ka.entries()) {
    const diff = x - (kb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return ka.length - kb.length || a.entityId.localeCompare(b.entityId)
}

/** The /24 an address belongs to (the whole string when it is not dotted IPv4). */
function prefix24(address: string): string {
  const parts = address.split('.')
  return parts.length === 4 ? parts.slice(0, 3).join('.') : address
}

/** Round-robin across /24 prefixes: one from each in turn, in a deterministic order. */
function roundRobin(group: SampleCandidate[], limit: number): SampleCandidate[] {
  const buckets = new Map<string, SampleCandidate[]>()
  for (const c of [...group].sort(compareAddress)) {
    const key = prefix24(c.address)
    buckets.set(key, [...(buckets.get(key) ?? []), c])
  }
  const queues = [...buckets.entries()]
    .sort((a, b) => compareAddress(a[1][0] as SampleCandidate, b[1][0] as SampleCandidate))
    .map(([, items]) => items)
  const out: SampleCandidate[] = []
  while (out.length < limit && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift()
      if (next && out.length < limit) out.push(next)
    }
  }
  return out
}

/**
 * Which devices a credential test probes: at most 10, the ones that already use
 * the credential first, then the ones with no credential, spread across /24s.
 * Pure — the caller supplies enabled, addressed devices.
 */
export function selectTestSample(
  candidates: readonly SampleCandidate[],
  max = TEST_SAMPLE_MAX,
): SampleCandidate[] {
  const users = roundRobin(
    candidates.filter((c) => c.usesCredential),
    max,
  )
  const rest = roundRobin(
    candidates.filter((c) => !c.usesCredential && c.hasNone),
    max - users.length,
  )
  return [...users, ...rest]
}

/**
 * The devices a test of `credentialId` probes in one topology. Explicit
 * `entityIds` win (capped); otherwise the sample is chosen by `selectTestSample`.
 * Only enabled devices with an address are eligible.
 */
export function pickTestSample(input: {
  nodes: ReadonlyArray<{ id: string; address?: string }>
  access: ReadonlyMap<string, { credentialId?: string; enabled: boolean }>
  credentialId?: string
  entityIds?: readonly string[]
}): Array<{ entityId: string; address: string }> {
  const only = input.entityIds ? new Set(input.entityIds) : undefined
  const eligible: SampleCandidate[] = []
  for (const node of input.nodes) {
    const address = node.address
    const row = input.access.get(node.id)
    if (!address || row?.enabled === false) continue
    if (only && !only.has(node.id)) continue
    eligible.push({
      entityId: node.id,
      address,
      usesCredential: input.credentialId !== undefined && row?.credentialId === input.credentialId,
      hasNone: !row?.credentialId,
    })
  }
  const chosen = only
    ? eligible.slice(0, TEST_SAMPLE_MAX)
    : selectTestSample(eligible, TEST_SAMPLE_MAX)
  return chosen.map(({ entityId, address }) => ({ entityId, address }))
}

/** Is this topology present? (for callers that need a 404 before anything else) */
export { topologyExists }
