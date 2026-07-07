// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Entity Registry - adopt-or-mint and entityId stamping.
 *
 * Key classes and matching rules (§570 hardening):
 *
 * Node key classes (descending strength):
 *   STRONG:  chassisId, vendor:* (per-namespace source primary keys), manual:*
 *   MUTABLE: mgmtIp, sysName  (singleton-replaced per source)
 *
 * Port key classes (descending strength):
 *   PRIMARY:     ifName
 *   SECONDARY:   mac
 *   LAST_RESORT: ifIndex  (only when observation has neither ifName nor mac)
 *
 * Staged lookup with STRONG-key veto:
 *   1. Query each class descending; stop at first class with candidates.
 *   2. VETO: candidate and observation both carry the same STRONG key namespace
 *      (chassisId, vendor:<ns>) with different values -> reject.
 *   3. MUTABLE mutual-consistency: ALL mutable keys on BOTH sides must agree.
 *   4. All vetoed -> continue; nothing left -> mint.
 *
 * Merge guard: auto-merge ONLY when all candidates share a STRONG key, OR
 * all agree on >=2 independent key classes. Otherwise adopt best + warn.
 *
 * Singleton-key replacement: mgmtIp/sysName per node, ifIndex per port are
 * per-source singletons (old value deleted, new inserted, others' rows untouched).
 *
 * parent_id sentinel: entity_identity_key.parent_id uses '' (empty string)
 * for node and link entities; port entities use the parent node entity id.
 *
 * See apps/server/docs/design/topology-foundation-entity-registry.md §2.
 */

import type { Database } from 'bun:sqlite'
import { randomBytes } from 'node:crypto'
import type {
  Identity,
  LayoutLink,
  LayoutNode,
  LayoutPort,
  LayoutResult,
  Link,
  LinkEndpoint,
  NetworkGraph,
  Node,
  NodePort,
  ResolvedEdge,
  ResolvedLayout,
  ResolvedPort,
} from '@shumoku/core'
import { timestamp } from '../db/index.js'
import { buildGraph } from './contribution-store.js'

// ---------------------------------------------------------------------------
// ULID generator (synchronous - safe to call inside bun:sqlite transactions)
// ---------------------------------------------------------------------------

const BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier).
 * Uses crypto.randomBytes so it is safe to call within a DB transaction.
 * Exported for testability (§570: ULID unit tests).
 */
export function generateUlid(): string {
  const t = Date.now()
  // Time part: 48-bit timestamp encoded as 10 Crockford base32 chars
  const timeChars: string[] = new Array(10)
  let ts = t
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = BASE32_CHARS[ts % 32] ?? '0'
    ts = Math.floor(ts / 32)
  }
  // Random part: 80 bits => 16 Crockford base32 chars
  const rand = randomBytes(10)
  let r = 0n
  for (const byte of rand) r = (r << 8n) | BigInt(byte)
  const randChars: string[] = new Array(16)
  for (let i = 15; i >= 0; i--) {
    randChars[i] = BASE32_CHARS[Number(r & 31n)] ?? '0'
    r >>= 5n
  }
  return timeChars.join('') + randChars.join('')
}

// ---------------------------------------------------------------------------
// Key normalisation
// ---------------------------------------------------------------------------

/** Normalise an identity key value for storage and lookup. */
function normalizeKeyValue(key: string, value: string): string {
  const trimmed = value.trim()
  switch (key) {
    case 'mgmtIp':
    case 'mac':
    case 'sysName':
      return trimmed.toLowerCase()
    default:
      return trimmed
  }
}

// ---------------------------------------------------------------------------
// Key class definitions
// ---------------------------------------------------------------------------

const NODE_KEY_CLASS = {
  STRONG: 'strong',
  MUTABLE: 'mutable',
} as const
type NodeKeyClass = (typeof NODE_KEY_CLASS)[keyof typeof NODE_KEY_CLASS]

const PORT_KEY_CLASS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  LAST_RESORT: 'last_resort',
} as const
type PortKeyClass = (typeof PORT_KEY_CLASS)[keyof typeof PORT_KEY_CLASS]

function nodeKeyClass(key: string): NodeKeyClass {
  if (key === 'mgmtIp' || key === 'sysName') return NODE_KEY_CLASS.MUTABLE
  return NODE_KEY_CLASS.STRONG
}

function portKeyClass(key: string): PortKeyClass {
  if (key === 'ifName') return PORT_KEY_CLASS.PRIMARY
  if (key === 'mac') return PORT_KEY_CLASS.SECONDARY
  return PORT_KEY_CLASS.LAST_RESORT
}

/** SINGLETON keys: per-source value is replaced (not accumulated) on adopt. */
const SINGLETON_NODE_KEYS = new Set(['mgmtIp', 'sysName'])
const SINGLETON_PORT_KEYS = new Set(['ifIndex'])
// ifName is PRIMARY but NOT singleton - replacing ifName re-keys the port.

// ---------------------------------------------------------------------------
// Identity key gathering
// ---------------------------------------------------------------------------

interface IdentityKey {
  key: string
  value: string
}

/**
 * Gather node identity keys in priority order: chassisId > vendorIds > mgmtIp > sysName.
 * Falls back to `manual:<sourceId>` when no network identity is available.
 */
function gatherNodeKeys(
  identity: Identity | undefined,
  sourceId: string,
  nodeId: string,
): IdentityKey[] {
  const keys: IdentityKey[] = []
  if (identity?.chassisId) {
    keys.push({ key: 'chassisId', value: normalizeKeyValue('chassisId', identity.chassisId) })
  }
  for (const [ns, v] of Object.entries(identity?.vendorIds ?? {})) {
    keys.push({ key: `vendor:${ns}`, value: normalizeKeyValue(`vendor:${ns}`, v) })
  }
  if (identity?.mgmtIp) {
    keys.push({ key: 'mgmtIp', value: normalizeKeyValue('mgmtIp', identity.mgmtIp) })
  }
  if (identity?.sysName) {
    keys.push({ key: 'sysName', value: normalizeKeyValue('sysName', identity.sysName) })
  }
  if (keys.length === 0) {
    keys.push({ key: `manual:${sourceId}`, value: nodeId })
  }
  return keys
}

/**
 * Gather port identity keys in priority order: ifName > mac > ifIndex.
 * ifIndex is only gathered when the observation has neither ifName nor mac.
 * Falls back to `manual:<sourceId>` when no port identity is available.
 */
function gatherPortKeys(
  identity: Identity | undefined,
  sourceId: string,
  portId: string,
): IdentityKey[] {
  const keys: IdentityKey[] = []
  if (identity?.ifName) {
    keys.push({ key: 'ifName', value: normalizeKeyValue('ifName', identity.ifName) })
  }
  if (identity?.mac) {
    keys.push({ key: 'mac', value: normalizeKeyValue('mac', identity.mac) })
  }
  if (!identity?.ifName && !identity?.mac && identity?.ifIndex !== undefined) {
    keys.push({ key: 'ifIndex', value: String(identity.ifIndex) })
  }
  if (keys.length === 0) {
    keys.push({ key: `manual:${sourceId}`, value: portId })
  }
  return keys
}

// ---------------------------------------------------------------------------
// Alias resolution
// ---------------------------------------------------------------------------

/**
 * Follow the alias chain for an entity id. Caps at depth 8 to prevent loops.
 *
 * Exported as {@link resolveEntityAlias} so reference tables keyed by entity id
 * (the metrics mapping in particular) can follow a merge.
 */
export function resolveEntityAlias(entityId: string, db: Database): string {
  return resolveAlias(entityId, db)
}

function resolveAlias(entityId: string, db: Database, depth = 0): string {
  if (depth >= 8) return entityId
  const row = db
    .query<{ new_id: string }, [string]>('SELECT new_id FROM entity_alias WHERE old_id = ?')
    .get(entityId)
  if (!row) return entityId
  return resolveAlias(row.new_id, db, depth + 1)
}

// ---------------------------------------------------------------------------
// Candidate entity enrichment
// ---------------------------------------------------------------------------

interface EntityKeyRow {
  key: string
  value: string
}

/** Load all identity keys currently stored for an entity. */
function loadEntityKeys(
  topologyId: string,
  kind: string,
  parentId: string,
  entityId: string,
  db: Database,
): Map<string, string[]> {
  const rows = db
    .query<EntityKeyRow, [string, string, string, string]>(
      `SELECT key, value FROM entity_identity_key
       WHERE topology_id = ? AND kind = ? AND parent_id = ? AND entity_id = ?`,
    )
    .all(topologyId, kind, parentId, entityId)
  const map = new Map<string, string[]>()
  for (const { key, value } of rows) {
    const existing = map.get(key)
    if (existing) {
      existing.push(value)
    } else {
      map.set(key, [value])
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Veto logic
// ---------------------------------------------------------------------------

function strongKeyNamespace(key: string): string | undefined {
  if (key === 'chassisId') return 'chassisId'
  if (key.startsWith('vendor:')) return key
  return undefined
}

/**
 * Apply the STRONG-key VETO rule.
 *
 * For each STRONG key namespace where BOTH the candidate entity and the observation
 * carry a value: if the candidate's value disagrees with the observation's value
 * -> the candidate is vetoed (return true).
 */
function isVetoed(obsKeys: IdentityKey[], entityKeys: Map<string, string[]>): boolean {
  for (const { key, value } of obsKeys) {
    const ns = strongKeyNamespace(key)
    if (!ns) continue
    const entityValues = entityKeys.get(key)
    if (!entityValues || entityValues.length === 0) continue
    if (!entityValues.includes(value)) return true
  }
  return false
}

/**
 * Apply the MUTABLE-class MUTUAL-CONSISTENCY rule.
 *
 * sysName is the device-identity arbiter: if both the observation and the
 * candidate carry a sysName and they conflict, the candidate is rejected.
 * mgmtIp differences are NOT grounds for rejection here — they are handled by
 * singleton-key replacement after adoption (an IP swap is a legitimate event).
 */
function failsMutualConsistency(
  obsKeys: IdentityKey[],
  entityKeys: Map<string, string[]>,
): boolean {
  const obsSysName = obsKeys.find((k) => k.key === 'sysName')
  if (!obsSysName) return false
  const entitySysNames = entityKeys.get('sysName')
  if (!entitySysNames || entitySysNames.length === 0) return false
  return !entitySysNames.includes(obsSysName.value)
}

// ---------------------------------------------------------------------------
// Staged lookup helpers
// ---------------------------------------------------------------------------

function countSharedKeyClasses(
  obsKeys: IdentityKey[],
  entityKeys: Map<string, string[]>,
  kind: 'node' | 'port',
): number {
  const matchedClasses = new Set<string>()
  for (const { key, value } of obsKeys) {
    const entityValues = entityKeys.get(key)
    if (!entityValues?.includes(value)) continue
    const cls = kind === 'node' ? nodeKeyClass(key) : portKeyClass(key)
    matchedClasses.add(cls)
  }
  return matchedClasses.size
}

function sharesStrongKey(obsKeys: IdentityKey[], entityKeys: Map<string, string[]>): boolean {
  for (const { key, value } of obsKeys) {
    if (nodeKeyClass(key) !== NODE_KEY_CLASS.STRONG) continue
    const entityValues = entityKeys.get(key)
    if (entityValues?.includes(value)) return true
  }
  return false
}

interface CandidateInfo {
  entityId: string
  firstSeenAt: number
  entityKeys: Map<string, string[]>
  matchClass: NodeKeyClass | PortKeyClass
}

/** Query entities matching any of the given keys (flat OR). Returns resolved unique ids. */
function queryCandidates(
  topologyId: string,
  kind: string,
  parentId: string,
  keys: IdentityKey[],
  db: Database,
): Array<{ entityId: string; firstSeenAt: number }> {
  if (keys.length === 0) return []
  const conditions = keys.map(() => '(key = ? AND value = ?)').join(' OR ')
  const params: (string | number)[] = [
    topologyId,
    kind,
    parentId,
    ...keys.flatMap((k) => [k.key, k.value]),
  ]
  const rows = db
    .query<{ entity_id: string }, (string | number)[]>(
      `SELECT DISTINCT entity_id FROM entity_identity_key
       WHERE topology_id = ? AND kind = ? AND parent_id = ?
       AND (${conditions})`,
    )
    .all(...params)

  const resolvedIds = new Set<string>()
  for (const { entity_id } of rows) {
    resolvedIds.add(resolveAlias(entity_id, db))
  }
  if (resolvedIds.size === 0) return []

  const placeholders = [...resolvedIds].map(() => '?').join(', ')
  const entities = db
    .query<{ id: string; first_seen_at: number }, string[]>(
      `SELECT id, first_seen_at FROM entity_registry
       WHERE id IN (${placeholders})
       ORDER BY first_seen_at ASC, id ASC`,
    )
    .all(...[...resolvedIds])
  return entities.map((e) => ({ entityId: e.id, firstSeenAt: e.first_seen_at }))
}

function queryAndVetoCandidates(
  topologyId: string,
  kind: string,
  parentId: string,
  classKeys: IdentityKey[],
  obsKeys: IdentityKey[],
  entityKind: 'node' | 'port',
  matchClass: NodeKeyClass | PortKeyClass,
  db: Database,
): CandidateInfo[] {
  const raw = queryCandidates(topologyId, kind, parentId, classKeys, db)
  const result: CandidateInfo[] = []
  for (const candidate of raw) {
    const eKeys = loadEntityKeys(topologyId, kind, parentId, candidate.entityId, db)
    if (isVetoed(obsKeys, eKeys)) continue
    if (entityKind === 'node' && matchClass === NODE_KEY_CLASS.MUTABLE) {
      if (failsMutualConsistency(obsKeys, eKeys)) continue
    }
    result.push({ ...candidate, entityKeys: eKeys, matchClass })
  }
  return result
}

function stagedLookupNode(
  topologyId: string,
  parentId: string,
  obsKeys: IdentityKey[],
  db: Database,
): CandidateInfo[] {
  const strongObs = obsKeys.filter((k) => nodeKeyClass(k.key) === NODE_KEY_CLASS.STRONG)
  const mutableObs = obsKeys.filter((k) => nodeKeyClass(k.key) === NODE_KEY_CLASS.MUTABLE)

  if (strongObs.length > 0) {
    const candidates = queryAndVetoCandidates(
      topologyId,
      'node',
      parentId,
      strongObs,
      obsKeys,
      'node',
      NODE_KEY_CLASS.STRONG,
      db,
    )
    if (candidates.length > 0) return candidates
  }

  if (mutableObs.length > 0) {
    const candidates = queryAndVetoCandidates(
      topologyId,
      'node',
      parentId,
      mutableObs,
      obsKeys,
      'node',
      NODE_KEY_CLASS.MUTABLE,
      db,
    )
    if (candidates.length > 0) return candidates
  }

  return []
}

function stagedLookupPort(
  topologyId: string,
  parentId: string,
  obsKeys: IdentityKey[],
  db: Database,
): CandidateInfo[] {
  const hasIfName = obsKeys.some((k) => k.key === 'ifName')
  const hasMac = obsKeys.some((k) => k.key === 'mac')
  const primaryObs = obsKeys.filter((k) => k.key === 'ifName')
  const secondaryObs = obsKeys.filter((k) => k.key === 'mac')
  const lastResortObs = !hasIfName && !hasMac ? obsKeys.filter((k) => k.key === 'ifIndex') : []

  if (primaryObs.length > 0) {
    const candidates = queryAndVetoCandidates(
      topologyId,
      'port',
      parentId,
      primaryObs,
      obsKeys,
      'port',
      PORT_KEY_CLASS.PRIMARY,
      db,
    )
    if (candidates.length > 0) return candidates
  }

  if (secondaryObs.length > 0) {
    const candidates = queryAndVetoCandidates(
      topologyId,
      'port',
      parentId,
      secondaryObs,
      obsKeys,
      'port',
      PORT_KEY_CLASS.SECONDARY,
      db,
    )
    if (candidates.length > 0) return candidates
  }

  if (lastResortObs.length > 0) {
    const candidates = queryAndVetoCandidates(
      topologyId,
      'port',
      parentId,
      lastResortObs,
      obsKeys,
      'port',
      PORT_KEY_CLASS.LAST_RESORT,
      db,
    )
    if (candidates.length > 0) return candidates
  }

  return []
}

function flatLookupCandidates(
  topologyId: string,
  kind: string,
  parentId: string,
  keys: IdentityKey[],
  db: Database,
): CandidateInfo[] {
  const raw = queryCandidates(topologyId, kind, parentId, keys, db)
  return raw.map((r) => ({
    ...r,
    entityKeys: new Map<string, string[]>(),
    matchClass: NODE_KEY_CLASS.STRONG as NodeKeyClass,
  }))
}

// ---------------------------------------------------------------------------
// Singleton-key replacement
// ---------------------------------------------------------------------------

function replaceSingletonKeys(
  topologyId: string,
  entityId: string,
  kind: string,
  parentId: string,
  keys: IdentityKey[],
  sourceId: string,
  singletonSet: Set<string>,
  db: Database,
): void {
  if (!sourceId) return
  for (const { key, value } of keys) {
    if (!singletonSet.has(key)) continue
    // Delete stale values for this entity from this source (value changed).
    db.query(
      `DELETE FROM entity_identity_key
       WHERE topology_id = ? AND entity_id = ? AND kind = ? AND parent_id = ?
         AND key = ? AND source_id = ? AND value != ?`,
    ).run(topologyId, entityId, kind, parentId, key, sourceId, value)
    // Release the same (key, value, source) from any OTHER entity so the
    // unique index allows us to claim it for this entity (IP moves, etc.).
    db.query(
      `DELETE FROM entity_identity_key
       WHERE topology_id = ? AND entity_id != ? AND kind = ? AND parent_id = ?
         AND key = ? AND value = ? AND source_id = ?`,
    ).run(topologyId, entityId, kind, parentId, key, value, sourceId)
  }
}

function insertIdentityKeys(
  topologyId: string,
  entityId: string,
  kind: string,
  parentId: string,
  keys: IdentityKey[],
  sourceId: string,
  db: Database,
): void {
  for (const { key, value } of keys) {
    db.query(
      `INSERT OR IGNORE INTO entity_identity_key
         (topology_id, entity_id, kind, parent_id, key, value, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(topologyId, entityId, kind, parentId, key, value, sourceId)
  }
}

// ---------------------------------------------------------------------------
// Core adopt-or-mint
// ---------------------------------------------------------------------------

function adoptOrMintEntity(
  topologyId: string,
  kind: string,
  parentId: string,
  entityParentId: string | null,
  keys: IdentityKey[],
  sourceId: string,
  singletonKeys: Set<string>,
  now: number,
  db: Database,
  entityKind: 'node' | 'port' | 'link',
): string {
  const candidates =
    entityKind === 'link'
      ? flatLookupCandidates(topologyId, kind, parentId, keys, db)
      : entityKind === 'node'
        ? stagedLookupNode(topologyId, parentId, keys, db)
        : stagedLookupPort(topologyId, parentId, keys, db)

  if (candidates.length === 0) {
    const entityId = generateUlid()
    db.query(
      `INSERT INTO entity_registry
         (id, topology_id, kind, parent_id, status, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).run(entityId, topologyId, kind, entityParentId, now, now)
    insertIdentityKeys(topologyId, entityId, kind, parentId, keys, sourceId, db)
    return entityId
  }

  if (candidates.length === 1) {
    const candidate = candidates[0]
    if (!candidate) return generateUlid()
    const entityId = candidate.entityId
    db.query(
      "UPDATE entity_registry SET last_seen_at = ?, status = 'active', retired_at = NULL WHERE id = ?",
    ).run(now, entityId)
    replaceSingletonKeys(topologyId, entityId, kind, parentId, keys, sourceId, singletonKeys, db)
    insertIdentityKeys(topologyId, entityId, kind, parentId, keys, sourceId, db)
    return entityId
  }

  // Multiple candidates: apply merge guard
  const allShareStrongKey = candidates.every((c) => sharesStrongKey(keys, c.entityKeys))
  const allAgreeOn2Classes = candidates.every(
    (c) => countSharedKeyClasses(keys, c.entityKeys, entityKind === 'port' ? 'port' : 'node') >= 2,
  )

  if (allShareStrongKey || allAgreeOn2Classes) {
    const sorted = [...candidates].sort(
      (a, b) => a.firstSeenAt - b.firstSeenAt || a.entityId.localeCompare(b.entityId),
    )
    const survivor = sorted[0]
    if (!survivor) return candidates[0]?.entityId ?? generateUlid()
    const survivorId = survivor.entityId
    for (const other of sorted.slice(1)) {
      db.query('INSERT OR IGNORE INTO entity_alias (old_id, new_id) VALUES (?, ?)').run(
        other.entityId,
        survivorId,
      )
    }
    db.query(
      "UPDATE entity_registry SET last_seen_at = ?, status = 'active', retired_at = NULL WHERE id = ?",
    ).run(now, survivorId)
    replaceSingletonKeys(topologyId, survivorId, kind, parentId, keys, sourceId, singletonKeys, db)
    insertIdentityKeys(topologyId, survivorId, kind, parentId, keys, sourceId, db)
    return survivorId
  }

  // Ambiguous weak multi-match: adopt best, no merge, warn
  const best = candidates[0]
  if (!best) return generateUlid()
  const entityId = best.entityId
  const ambiguousIds = candidates.map((c) => c.entityId).join(', ')
  const matchedKeys = keys.map((k) => `${k.key}=${k.value}`).join(', ')
  console.warn(
    `[Registry] ambiguous match — topology=${topologyId} kind=${kind} keys=[${matchedKeys}] ` +
      `candidates=[${ambiguousIds}] — adopting ${entityId} (no merge; deferred review needed)`,
  )
  db.query(
    "UPDATE entity_registry SET last_seen_at = ?, status = 'active', retired_at = NULL WHERE id = ?",
  ).run(now, entityId)
  replaceSingletonKeys(topologyId, entityId, kind, parentId, keys, sourceId, singletonKeys, db)
  insertIdentityKeys(topologyId, entityId, kind, parentId, keys, sourceId, db)
  return entityId
}

// ---------------------------------------------------------------------------
// Public API - adopt-or-mint for a whole graph
// ---------------------------------------------------------------------------

/**
 * Adopt-or-mint entity_registry rows for every node, port, and link in a
 * source's contribution.  Must be called after `ingestGraph` on the same DB
 * connection.
 */
export function adoptOrMintForGraph(
  topologyId: string,
  sourceId: string,
  db: Database,
  now = timestamp(),
): number {
  const graph = buildGraph(topologyId, sourceId, db)
  if (!graph) return now

  const nodeEntityIds = new Map<string, string>()
  for (const node of graph.nodes ?? []) {
    const keys = gatherNodeKeys(node.identity, sourceId, node.id)
    const entityId = adoptOrMintEntity(
      topologyId,
      'node',
      '',
      null,
      keys,
      sourceId,
      SINGLETON_NODE_KEYS,
      now,
      db,
      'node',
    )
    nodeEntityIds.set(node.id, entityId)
  }

  const portEntityIds = new Map<string, string>()
  for (const node of graph.nodes ?? []) {
    const nodeEntityId = nodeEntityIds.get(node.id)
    if (!nodeEntityId) continue
    for (const port of node.ports ?? []) {
      const keys = gatherPortKeys(port.identity, sourceId, port.id)
      const entityId = adoptOrMintEntity(
        topologyId,
        'port',
        nodeEntityId,
        nodeEntityId,
        keys,
        sourceId,
        SINGLETON_PORT_KEYS,
        now,
        db,
        'port',
      )
      portEntityIds.set(`${node.id}:${port.id}`, entityId)
    }
  }

  for (const link of graph.links ?? []) {
    const fromComposite = link.from.port ? `${link.from.node}:${link.from.port}` : undefined
    const toComposite = link.to.port ? `${link.to.node}:${link.to.port}` : undefined
    const fromPortEntityId = fromComposite ? portEntityIds.get(fromComposite) : undefined
    const toPortEntityId = toComposite ? portEntityIds.get(toComposite) : undefined
    if (!fromPortEntityId || !toPortEntityId) continue
    const [pA, pB] = [fromPortEntityId, toPortEntityId].sort()
    const linkKey: IdentityKey[] = [{ key: 'endpoints', value: `${pA}|${pB}` }]
    adoptOrMintEntity(
      topologyId,
      'link',
      '',
      null,
      linkKey,
      sourceId,
      new Set<string>(),
      now,
      db,
      'link',
    )
  }
  return now
}

// ---------------------------------------------------------------------------
// Public API - entity retirement
// ---------------------------------------------------------------------------

export const RETIRE_THRESHOLD_SYNCS = 3

export function retireStaleEntities(
  topologyId: string,
  sourceId: string,
  syncNow: number,
  db: Database,
): number {
  db.query(
    `INSERT OR REPLACE INTO entity_retire_counter (topology_id, source_id, entity_id, miss_count)
     SELECT ?, ?, er.id, 0
     FROM entity_registry er
     WHERE er.topology_id = ? AND er.status = 'active' AND er.last_seen_at >= ?`,
  ).run(topologyId, sourceId, topologyId, syncNow)

  db.query(
    `UPDATE entity_retire_counter
       SET miss_count = miss_count + 1
     WHERE topology_id = ? AND source_id = ?
       AND entity_id IN (
         SELECT er.id FROM entity_registry er
         WHERE er.topology_id = ? AND er.status = 'active' AND er.last_seen_at < ?
       )`,
  ).run(topologyId, sourceId, topologyId, syncNow)

  const result = db
    .query(
      `UPDATE entity_registry SET status = 'retired', retired_at = ?
     WHERE topology_id = ? AND status = 'active'
       AND id IN (
         SELECT entity_id FROM entity_retire_counter
         WHERE topology_id = ? AND source_id = ?
           AND miss_count >= ?
       )`,
    )
    .run(syncNow, topologyId, topologyId, sourceId, RETIRE_THRESHOLD_SYNCS)
  return result.changes
}

// ---------------------------------------------------------------------------
// Public API - stamp entityId onto a resolved graph (read-only registry access)
// ---------------------------------------------------------------------------

function lookupNodeEntityId(
  topologyId: string,
  identity: Identity | undefined,
  db: Database,
): string | undefined {
  if (!identity) return undefined
  const keys = gatherNodeKeys(identity, '', '').filter((k) => !k.key.startsWith('manual:'))
  if (keys.length === 0) return undefined
  const candidates = stagedLookupNode(topologyId, '', keys, db)
  return candidates[0]?.entityId
}

function lookupPortEntityId(
  topologyId: string,
  nodeEntityId: string,
  identity: Identity | undefined,
  db: Database,
): string | undefined {
  if (!identity) return undefined
  const keys = gatherPortKeys(identity, '', '').filter((k) => !k.key.startsWith('manual:'))
  if (keys.length === 0) return undefined
  const candidates = stagedLookupPort(topologyId, nodeEntityId, keys, db)
  return candidates[0]?.entityId
}

function lookupLinkEntityId(
  topologyId: string,
  portAEntityId: string,
  portBEntityId: string,
  db: Database,
): string | undefined {
  const [pA, pB] = [portAEntityId, portBEntityId].sort()
  const keys: IdentityKey[] = [{ key: 'endpoints', value: `${pA}|${pB}` }]
  const candidates = flatLookupCandidates(topologyId, 'link', '', keys, db)
  return candidates[0]?.entityId
}

export function stampEntityIds(
  topologyId: string,
  graph: NetworkGraph,
  db: Database,
): NetworkGraph {
  const portEntityByNodePort = new Map<string, string>()

  const stampedNodes: Node[] = graph.nodes.map((node) => {
    const nodeEntityId = lookupNodeEntityId(topologyId, node.identity, db)

    const stampedPorts: NodePort[] | undefined = node.ports?.map((port) => {
      if (!nodeEntityId) return port
      const portEntityId = lookupPortEntityId(topologyId, nodeEntityId, port.identity, db)
      if (!portEntityId) return port
      portEntityByNodePort.set(`${node.id}:${port.id}`, portEntityId)
      return { ...port, entityId: portEntityId }
    })

    if (!nodeEntityId) {
      if (stampedPorts) return { ...node, ports: stampedPorts }
      return node
    }
    const withEntity: Node = { ...node, entityId: nodeEntityId }
    if (stampedPorts) withEntity.ports = stampedPorts
    return withEntity
  })

  const stampedLinks: Link[] = graph.links.map((link) => {
    const fromKey = link.from.port ? `${link.from.node}:${link.from.port}` : undefined
    const toKey = link.to.port ? `${link.to.node}:${link.to.port}` : undefined
    const fromPortEntityId = fromKey ? portEntityByNodePort.get(fromKey) : undefined
    const toPortEntityId = toKey ? portEntityByNodePort.get(toKey) : undefined
    if (!fromPortEntityId || !toPortEntityId) return link
    const linkEntityId = lookupLinkEntityId(topologyId, fromPortEntityId, toPortEntityId, db)
    if (!linkEntityId) return link
    return { ...link, entityId: linkEntityId }
  })

  return { ...graph, nodes: stampedNodes, links: stampedLinks }
}

// ---------------------------------------------------------------------------
// Public API - flip resolved element ids to their entity ids (Phase 3)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

/**
 * Canonical, order-independent endpoint signature for a link.  Used to
 * correlate a laid-out edge back to the (entityId-stamped) graph link WITHOUT
 * depending on the layout engine's positional `__link_${i}` keying -- that index
 * differs between the simple and composite engines, so an endpoint match is the
 * only engine-independent correlation.  Control-char separators (U+0000 /
 * U+0001) keep a node id or port name that contains ':' from colliding.
 */
const SIG_FIELD_SEP = String.fromCharCode(0)
const SIG_PAIR_SEP = String.fromCharCode(1)
function endpointSignature(from: LinkEndpoint, to: LinkEndpoint): string {
  const a = `${from.node}${SIG_FIELD_SEP}${from.port ?? ''}`
  const b = `${to.node}${SIG_FIELD_SEP}${to.port ?? ''}`
  return a <= b ? `${a}${SIG_PAIR_SEP}${b}` : `${b}${SIG_PAIR_SEP}${a}`
}

/**
 * Rewrite the node-id prefix of a resolved port id (`${nodeId}:${portName}`)
 * when the node was flipped.  `port.id` (the port's own local name) is NEVER
 * flipped — only the composite resolved port id's node prefix moves, so the
 * `resolved.ports` keys and `edge.fromPortId`/`toPortId` still resolve after the
 * node flip.  Uses the known old node id to strip exactly its prefix, so a port
 * name containing ':' survives intact.
 */
function remapPortId(portId: string, oldNodeId: string, newNodeId: string): string {
  if (oldNodeId === newNodeId) return portId
  const prefix = `${oldNodeId}:`
  return portId.startsWith(prefix) ? `${newNodeId}:${portId.slice(prefix.length)}` : portId
}

interface FlipMaps {
  /** old node id → new node id (entity id); only entries that actually change */
  nodeIdMap: Map<string, string>
  /** endpoint signature → new link id (entity id), for links that carry one */
  linkEntityByEndpoints: Map<string, string>
}

/** Build the flip maps from an already entityId-stamped graph. */
function buildFlipMaps(graph: NetworkGraph): FlipMaps {
  const nodeIdMap = new Map<string, string>()
  for (const n of graph.nodes) {
    if (n.entityId && n.entityId !== n.id) nodeIdMap.set(n.id, n.entityId)
  }
  const linkEntityByEndpoints = new Map<string, string>()
  for (const l of graph.links) {
    if (l.entityId) linkEntityByEndpoints.set(endpointSignature(l.from, l.to), l.entityId)
  }
  return { nodeIdMap, linkEntityByEndpoints }
}

const mapNodeId = (maps: FlipMaps, id: string): string => maps.nodeIdMap.get(id) ?? id

/** Flip a link's `id` (to its entity id) and its endpoint node references. */
function flipEmbeddedLink(link: Link, newId: string | undefined, maps: FlipMaps): Link {
  const fromNode = mapNodeId(maps, link.from.node)
  const toNode = mapNodeId(maps, link.to.node)
  const idChanges = newId !== undefined && link.id !== newId
  if (!idChanges && fromNode === link.from.node && toNode === link.to.node) return link
  const next: Link = { ...link }
  if (newId !== undefined) next.id = newId
  if (fromNode !== link.from.node) next.from = { ...link.from, node: fromNode }
  if (toNode !== link.to.node) next.to = { ...link.to, node: toNode }
  return next
}

/**
 * Flip a graph's `node.id` / `link.id` to their entity ids and rewrite every
 * `link.from.node` / `link.to.node` accordingly.  `port.id`, subgraph ids and
 * `node.parent` (a subgraph id) are deliberately left untouched.  Elements
 * without an entity id keep their existing id.  Pure — never mutates input.
 */
function flipGraph(graph: NetworkGraph, maps: FlipMaps): NetworkGraph {
  const nodes = graph.nodes.map((n) =>
    n.entityId && n.entityId !== n.id ? { ...n, id: n.entityId } : n,
  )
  const links = graph.links.map((l) => {
    const newId = l.entityId
    return flipEmbeddedLink(l, newId, maps)
  })
  return { ...graph, nodes, links }
}

/** Flip the legacy LayoutResult (node/link map keys + embedded refs). */
function flipLayout(layout: LayoutResult, maps: FlipMaps): LayoutResult {
  const nodes = new Map<string, LayoutNode>()
  for (const [id, ln] of layout.nodes) {
    const nid = mapNodeId(maps, id)
    let ports = ln.ports
    if (ln.ports) {
      const remapped = new Map<string, LayoutPort>()
      for (const [pid, lp] of ln.ports) {
        const npid = remapPortId(pid, id, nid)
        remapped.set(npid, npid === pid ? lp : { ...lp, id: npid })
      }
      ports = remapped
    }
    const node = ln.node.id === nid ? ln.node : { ...ln.node, id: nid }
    nodes.set(nid, { ...ln, id: nid, node, ...(ports ? { ports } : {}) })
  }
  const links = new Map<string, LayoutLink>()
  for (const [key, ll] of layout.links) {
    const fromNode = mapNodeId(maps, ll.from)
    const toNode = mapNodeId(maps, ll.to)
    const newId = maps.linkEntityByEndpoints.get(endpointSignature(ll.fromEndpoint, ll.toEndpoint))
    const nkey = newId ?? key
    const fromEndpoint =
      ll.fromEndpoint.node === fromNode ? ll.fromEndpoint : { ...ll.fromEndpoint, node: fromNode }
    const toEndpoint =
      ll.toEndpoint.node === toNode ? ll.toEndpoint : { ...ll.toEndpoint, node: toNode }
    links.set(nkey, {
      ...ll,
      id: nkey,
      from: fromNode,
      to: toNode,
      fromEndpoint,
      toEndpoint,
      link: flipEmbeddedLink(ll.link, newId, maps),
    })
  }
  // Subgraphs are keyed by subgraph id and hold no node-id references → as-is.
  return { ...layout, nodes, links }
}

/** Flip a resolved port's composite id + nodeId when its node was flipped. */
function flipResolvedPort(rp: ResolvedPort, maps: FlipMaps): ResolvedPort {
  const nid = mapNodeId(maps, rp.nodeId)
  if (nid === rp.nodeId) return rp
  return { ...rp, id: remapPortId(rp.id, rp.nodeId, nid), nodeId: nid }
}

/** Flip the ResolvedLayout (node/port/edge map keys + embedded refs). */
function flipResolved(resolved: ResolvedLayout, maps: FlipMaps): ResolvedLayout {
  const nodes = new Map<string, Node>()
  for (const [id, n] of resolved.nodes) {
    const nid = mapNodeId(maps, id)
    nodes.set(nid, nid === n.id ? n : { ...n, id: nid })
  }
  const ports = new Map<string, ResolvedPort>()
  for (const [pid, rp] of resolved.ports) {
    const nid = mapNodeId(maps, rp.nodeId)
    const npid = remapPortId(pid, rp.nodeId, nid)
    ports.set(npid, npid === pid ? rp : flipResolvedPort(rp, maps))
  }
  const edges = new Map<string, ResolvedEdge>()
  for (const [key, re] of resolved.edges) {
    const fromNodeId = mapNodeId(maps, re.fromNodeId)
    const toNodeId = mapNodeId(maps, re.toNodeId)
    const newId = maps.linkEntityByEndpoints.get(endpointSignature(re.fromEndpoint, re.toEndpoint))
    const nkey = newId ?? key
    const fromEndpoint =
      re.fromEndpoint.node === fromNodeId
        ? re.fromEndpoint
        : { ...re.fromEndpoint, node: fromNodeId }
    const toEndpoint =
      re.toEndpoint.node === toNodeId ? re.toEndpoint : { ...re.toEndpoint, node: toNodeId }
    edges.set(nkey, {
      ...re,
      id: nkey,
      fromNodeId,
      toNodeId,
      fromPortId: remapPortId(re.fromPortId, re.fromNodeId, fromNodeId),
      toPortId: remapPortId(re.toPortId, re.toNodeId, toNodeId),
      fromPort: flipResolvedPort(re.fromPort, maps),
      toPort: flipResolvedPort(re.toPort, maps),
      fromEndpoint,
      toEndpoint,
      link: flipEmbeddedLink(re.link, newId, maps),
    })
  }
  // Subgraphs (+ their boundary ports) are keyed by subgraph id → untouched.
  return { ...resolved, nodes, ports, edges }
}

/**
 * Flip a graph-only structure's element ids to their entity ids.  Used to
 * migrate the project overlay's authored node/link local ids so they line up
 * with the post-flip resolved ids (the overlay anchors by identity, so the
 * local id is free to move).  The graph MUST already be entityId-stamped.
 */
export function flipGraphToEntityIds(graph: NetworkGraph): NetworkGraph {
  return flipGraph(graph, buildFlipMaps(graph))
}

/**
 * The Phase 3 flip: rewrite `node.id` / `link.id` on the resolved graph — AND
 * the layout + resolved artifact that share those ids — to the stable entity
 * ids stamped by {@link stampEntityIds}.  After this, `node.id === node.entityId`
 * and `link.id === link.entityId` for every element the registry knows, so all
 * downstream references (metrics mapping, weathermap data-ids, the client
 * viewer's graph↔resolved join) key on a stable id.  `port.id` is preserved;
 * only the composite resolved port id's node prefix moves so the maps stay
 * consistent.  Graph, layout, and resolved are flipped with ONE shared id map
 * so the baked artifact never disagrees with itself.  Pure — never mutates.
 */
export function flipToEntityIds(
  graph: NetworkGraph,
  layout: LayoutResult,
  resolved: ResolvedLayout | undefined,
): { graph: NetworkGraph; layout: LayoutResult; resolved?: ResolvedLayout } {
  const maps = buildFlipMaps(graph)
  if (maps.nodeIdMap.size === 0 && maps.linkEntityByEndpoints.size === 0) {
    // Nothing stamped → nothing to flip (avoids needless copies of a big layout).
    return { graph, layout, resolved }
  }
  return {
    graph: flipGraph(graph, maps),
    layout: flipLayout(layout, maps),
    resolved: resolved ? flipResolved(resolved, maps) : undefined,
  }
}
