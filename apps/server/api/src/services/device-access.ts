// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Device access — which credential reads which device.
 *
 * `device_access` has one row per node entity, pointing at a credential and
 * recording the last read (see migration 035; the credentials themselves live
 * in `./credentials`). This is feature configuration, not an observation and
 * not authorship of the graph, so it lives outside the contribution/overlay
 * machinery.
 */

import { getDatabase, timestamp } from '../db/index.js'
import {
  credentialsForTrial,
  deleteBlankRows,
  isLinked,
  loadCredentialParams,
  type ReadStatus,
  topologyClock,
} from './credentials.js'

export type { ReadStatus }

export interface DeviceAccess {
  entityId: string
  credentialId?: string
  enabled: boolean
  lastReadAt?: number
  lastStatus?: ReadStatus
  lastError?: string
  /** When every linked credential was tried on this device and none answered. */
  triedAt?: number
  /** Who wrote `credentialId`: 'probe' (found by trying), absent when a person chose it. */
  assignedBy?: 'probe'
}

/**
 * Where a device stands, derived from its row, its address and the topology's
 * retry clock — never stored. Listed in the order a person should look at them.
 */
export type DeviceState =
  | 'lost' // had a credential, and the last read failed
  | 'partial' // the device answered but part of the read failed
  | 'unconfirmed' // no credential yet, not tried since the credentials last changed
  | 'pending' // has a credential, never read
  | 'ok' // read cleanly
  | 'silent' // every credential was tried and none answered
  | 'no-address' // nothing to read it at
  | 'disabled' // the operator turned reading off

export interface DeviceAccessPatch {
  /** `null` un-assigns the credential. */
  credentialId?: string | null
  enabled?: boolean
}

export interface ReadOutcome {
  entityId: string
  status: ReadStatus
  error?: string
}

/** A device ready to be read: where, and with what. */
export interface ReadTarget {
  entityId: string
  address: string
  community: string
}

/** A device worth trying the credentials on. */
export interface TrialCandidate {
  entityId: string
  address: string
  /**
   * Present for a "lost retry": the device already holds this credential and
   * its last read failed, so only the OTHER credentials are tried on it.
   */
  skipCredentialId?: string
}

interface AccessRow {
  entity_id: string
  credential_id: string | null
  enabled: number
  last_read_at: number | null
  last_status: string | null
  last_error: string | null
  tried_at: number | null
  assigned_by: string | null
}

const ACCESS_COLUMNS =
  'entity_id, credential_id, enabled, last_read_at, last_status, last_error, tried_at, assigned_by'

function rowToAccess(row: AccessRow): DeviceAccess {
  return {
    entityId: row.entity_id,
    enabled: row.enabled === 1,
    ...(row.credential_id != null ? { credentialId: row.credential_id } : {}),
    ...(row.last_read_at != null ? { lastReadAt: row.last_read_at } : {}),
    ...(row.last_status != null ? { lastStatus: row.last_status as ReadStatus } : {}),
    ...(row.last_error != null ? { lastError: row.last_error } : {}),
    ...(row.tried_at != null ? { triedAt: row.tried_at } : {}),
    ...(row.assigned_by === 'probe' ? { assignedBy: 'probe' as const } : {}),
  }
}

/** All device_access rows of a topology, keyed by entity id. */
export function listDeviceAccess(topologyId: string): Map<string, DeviceAccess> {
  const rows = getDatabase()
    .query(`SELECT ${ACCESS_COLUMNS} FROM device_access WHERE topology_id = ?`)
    .all(topologyId) as AccessRow[]
  return new Map(rows.map((r) => [r.entity_id, rowToAccess(r)]))
}

/**
 * Set the credential and/or enabled flag on many devices at once. Entities
 * that are not nodes of this topology are skipped and reported. A credential
 * must be linked to the topology — an unlinked one is never used here. Fields
 * left `undefined` keep their value on rows that exist and default on new ones
 * (no credential, enabled).
 */
export function setDeviceAccess(
  topologyId: string,
  entityIds: readonly string[],
  patch: DeviceAccessPatch,
): { updated: number; skipped: string[] } | { error: string; status: 400 | 404 } {
  if (patch.credentialId === undefined && patch.enabled === undefined) {
    return { error: 'nothing to update: provide credentialId or enabled', status: 400 }
  }
  if (typeof patch.credentialId === 'string' && !isLinked(topologyId, patch.credentialId)) {
    return { error: 'credential not found', status: 404 }
  }
  const db = getDatabase()
  const isNode = db.query(
    "SELECT 1 FROM entity_registry WHERE id = ? AND topology_id = ? AND kind = 'node'",
  )
  const now = timestamp()
  const setCredential = patch.credentialId !== undefined ? 1 : 0
  const setEnabled = patch.enabled !== undefined ? 1 : 0
  const upsert = db.query(
    `INSERT INTO device_access (entity_id, topology_id, credential_id, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(entity_id) DO UPDATE SET
       credential_id = CASE WHEN ? THEN excluded.credential_id ELSE device_access.credential_id END,
       -- A person choosing (or clearing) the credential replaces what a trial found
       -- and resets the "answered none of them" memory.
       assigned_by = CASE WHEN ? THEN NULL ELSE device_access.assigned_by END,
       tried_at = CASE WHEN ? THEN NULL ELSE device_access.tried_at END,
       enabled = CASE WHEN ? THEN excluded.enabled ELSE device_access.enabled END,
       updated_at = excluded.updated_at`,
  )
  const skipped: string[] = []
  let updated = 0
  db.transaction(() => {
    for (const entityId of new Set(entityIds)) {
      if (isNode.get(entityId, topologyId) === null) {
        skipped.push(entityId)
        continue
      }
      upsert.run(
        entityId,
        topologyId,
        patch.credentialId ?? null,
        patch.enabled === false ? 0 : 1,
        now,
        setCredential,
        setCredential,
        setCredential,
        setEnabled,
      )
      updated++
    }
    deleteBlankRows(topologyId)
  })()
  return { updated, skipped }
}

/** Record how the last read of each device went. */
export function recordReadOutcomes(
  topologyId: string,
  outcomes: readonly ReadOutcome[],
  readAt: number,
): void {
  if (outcomes.length === 0) return
  const db = getDatabase()
  const update = db.query(
    `UPDATE device_access
        SET last_read_at = ?, last_status = ?, last_error = ?, updated_at = ?
      WHERE entity_id = ? AND topology_id = ?`,
  )
  const now = timestamp()
  db.transaction(() => {
    for (const o of outcomes) {
      update.run(readAt, o.status, o.error ?? null, now, o.entityId, topologyId)
    }
  })()
}

/** A node of the topology as device access sees it: its id (which IS its entity id) and its address. */
export interface DeviceNode {
  id: string
  address?: string
}

/** The devices of a parsed topology. The address is an attribute the merge records, not part of the graph. */
export function deviceNodes(parsed: {
  graph: { nodes: ReadonlyArray<{ id: string }> }
  record: { attributes: Readonly<Record<string, { address?: string } | undefined>> }
}): DeviceNode[] {
  return parsed.graph.nodes.map((node) => {
    const address = parsed.record.attributes[node.id]?.address
    return address ? { id: node.id, address } : { id: node.id }
  })
}

/**
 * The devices that can be read now: enabled, holding a credential this
 * topology links, of a method the reader speaks, and with a management
 * address. Keyed by the node's id, which IS its entity id in a resolved graph.
 * `only` narrows to given entities.
 */
export function resolveReadTargets(
  topologyId: string,
  nodes: ReadonlyArray<DeviceNode>,
  only?: ReadonlySet<string>,
): ReadTarget[] {
  const access = listDeviceAccess(topologyId)
  const communities = new Map<string, string | undefined>()
  const communityOf = (credentialId: string): string | undefined => {
    if (!communities.has(credentialId)) {
      const linked = isLinked(topologyId, credentialId)
      const credential = linked ? loadCredentialParams(credentialId) : null
      communities.set(
        credentialId,
        credential?.method === 'snmp' ? credential.params['community'] : undefined,
      )
    }
    return communities.get(credentialId)
  }
  const targets: ReadTarget[] = []
  const seenAddress = new Set<string>()
  for (const node of nodes) {
    if (only && !only.has(node.id)) continue
    const row = access.get(node.id)
    if (!row?.enabled || !row.credentialId) continue
    const community = communityOf(row.credentialId)
    const address = node.address
    if (!community || !address || seenAddress.has(address)) continue
    seenAddress.add(address)
    targets.push({ entityId: node.id, address, community })
  }
  return targets
}

// ── Finding the credential by trying ───────────────────────────────────────

/**
 * Devices worth trying the topology's credentials on.
 *
 * 1. Enabled devices with an address and no credential. One that already
 *    answered none of them is skipped until the retry clock moves (`force` — a
 *    person asking for that very device — tries it anyway).
 * 2. "Lost retry": enabled devices that HAVE a credential whose last read
 *    failed before the clock last moved, when the topology links at least one
 *    other credential. Only the other credentials are tried on them.
 */
export function resolveTrialCandidates(
  topologyId: string,
  nodes: ReadonlyArray<DeviceNode>,
  options: { only?: ReadonlySet<string>; force?: boolean } = {},
): TrialCandidate[] {
  const access = listDeviceAccess(topologyId)
  const clock = topologyClock(topologyId)
  const trialable = credentialsForTrial(topologyId)
  const candidates: TrialCandidate[] = []
  const seenAddress = new Set<string>()
  for (const node of nodes) {
    if (options.only && !options.only.has(node.id)) continue
    const row = access.get(node.id)
    if (row?.enabled === false) continue
    const address = node.address
    if (!address || seenAddress.has(address)) continue
    if (row?.credentialId) {
      const others = trialable.filter((c) => c.id !== row.credentialId)
      if (
        row.lastStatus === 'failed' &&
        row.lastReadAt != null &&
        row.lastReadAt < clock &&
        others.length > 0
      ) {
        seenAddress.add(address)
        candidates.push({ entityId: node.id, address, skipCredentialId: row.credentialId })
      }
      continue
    }
    if (trialable.length === 0) continue
    if (!options.force && row?.triedAt != null && row.triedAt >= clock) continue
    seenAddress.add(address)
    candidates.push({ entityId: node.id, address })
  }
  return candidates
}

/**
 * Write what a trial learned: the credential that answered goes on the
 * device's row (marked as found by trial), and a device that answered none is
 * stamped so it is not tried again until the credentials change. Lost-retry
 * devices that answered none are NOT in `silent` — they are left untouched.
 */
export function applyTrialResult(
  topologyId: string,
  result: {
    matched: ReadonlyArray<{ entityId: string; credentialId: string }>
    silent: readonly string[]
  },
  triedAt: number,
): void {
  const db = getDatabase()
  const isNode = db.query(
    "SELECT 1 FROM entity_registry WHERE id = ? AND topology_id = ? AND kind = 'node'",
  )
  const now = timestamp()
  const assign = db.query(
    `INSERT INTO device_access (entity_id, topology_id, credential_id, enabled, assigned_by, updated_at)
     VALUES (?, ?, ?, 1, 'probe', ?)
     ON CONFLICT(entity_id) DO UPDATE SET
       credential_id = excluded.credential_id, assigned_by = 'probe', tried_at = NULL,
       updated_at = excluded.updated_at`,
  )
  const stamp = db.query(
    `INSERT INTO device_access (entity_id, topology_id, enabled, tried_at, updated_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(entity_id) DO UPDATE SET tried_at = excluded.tried_at, updated_at = excluded.updated_at`,
  )
  db.transaction(() => {
    for (const m of result.matched) {
      if (isNode.get(m.entityId, topologyId) !== null && isLinked(topologyId, m.credentialId)) {
        assign.run(m.entityId, topologyId, m.credentialId, now)
      }
    }
    for (const entityId of result.silent) {
      if (isNode.get(entityId, topologyId) !== null) stamp.run(entityId, topologyId, triedAt, now)
    }
  })()
}

/**
 * Where a device stands. Derived each time from its row, its address and the
 * topology's retry clock (`topologyClock`), so there is no state to keep in
 * step.
 */
export function deriveDeviceState(
  device: { mgmtIp?: string },
  row: DeviceAccess | undefined,
  clock: number,
): DeviceState {
  if (row?.enabled === false) return 'disabled'
  if (!device.mgmtIp) return 'no-address'
  if (row?.credentialId) {
    if (row.lastStatus === 'failed') return 'lost'
    if (row.lastStatus === 'partial') return 'partial'
    if (row.lastStatus === 'ok') return 'ok'
    return 'pending'
  }
  return row?.triedAt != null && row.triedAt >= clock ? 'silent' : 'unconfirmed'
}
