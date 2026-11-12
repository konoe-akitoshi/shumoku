// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Entity Registry - adopt-or-mint and entityId stamping.
 *
 * Key classes and matching rules (§570 hardening):
 *
 * Node key classes (descending strength):
 *   STRONG:  chassisId, vendor:* (per-namespace source primary keys), manual:*
 *   MUTABLE: mgmtIp, sysName, mac  (singleton-replaced per source)
 *
 * `mac` on a NODE is the device's own hardware address (its chassis or
 * management address) — distinct from `mac` on a PORT, which is that one
 * interface's. It is MUTABLE rather than STRONG deliberately: sources disagree
 * about *which* of a device's addresses to report (one gives the LLDP chassis
 * MAC, another the management interface it answered ARP with), and a STRONG
 * mismatch vetoes the candidate outright, which would split a device that
 * mgmtIp alone would have matched. As MUTABLE it can pull two views of one
 * device together without ever forcing them apart.
 *
 * Port key classes (descending strength):
 *   PRIMARY:     ifName (the port's name), manual:* (fallback — never gathered any more: every
 *                port has a name)
 *   SECONDARY:   mac
 *   LAST_RESORT: ifIndex — rows older than the move of identity into the configuration; no
 *                longer gathered, since a port always has its name
 *
 * Staged lookup with STRONG-key veto:
 *   1. Query each class descending; stop at first class with candidates.
 *   2. VETO: candidate and observation both carry the same STRONG key namespace
 *      (chassisId, vendor:<ns>) with different values -> reject.
 *   3. MUTABLE mutual-consistency: a sysName present on BOTH sides must agree
 *      (sysName is the device-identity arbiter; mgmtIp conflicts are NOT grounds
 *      for rejection — an IP swap is legitimate and handled by replacement).
 *   4. All vetoed -> continue; nothing left -> mint.
 *
 * Merge guard: auto-merge ONLY when all candidates share a merge-strong key
 * (node: STRONG class; port: ifName/manual:* — never mac or ifIndex alone),
 * OR all agree on >=2 independent key classes. Otherwise adopt the best
 * candidate (highest class, tie -> oldest) WITHOUT merging and console.warn
 * a structured `[Registry] ambiguous match` line for deferred review.
 *
 * Singleton-key replacement: mgmtIp/sysName/mac per node are per-source singletons — on adopt
 * AND mint the source's stale rows (or legacy source_id = '' rows) are deleted before insert;
 * other sources' rows survive. ifName is PRIMARY but NOT singleton: replacing ifName would
 * re-key the port.
 *
 * Where the keys come from: the attributes a device is recognized by are configuration
 * (`inputModel.Node.address` → the `mgmtIp` row, `chassisId`, `sysName`, `mac`; a port's name →
 * `ifName`, its `mac`), a source's own ids ride in its observation (`vendorIds` → `vendor:<ns>`).
 * The row names keep their pre-2026-11 spelling so stored registries read on.
 *
 * parent_id sentinel: entity_identity_key.parent_id uses '' (empty string)
 * for node and link entities; port entities use the parent node entity id.
 *
 * See apps/server/docs/design/topology-foundation-entity-registry.md §2.
 */

import type { Database } from 'bun:sqlite'
import { randomBytes } from 'node:crypto'
import type {
  DeviceKeys,
  DrawingScene,
  EntityId,
  inputModel,
  Link,
  LinkEndpoint,
  NetworkGraph,
  ObservationLayer,
  PortKeys,
} from '@shumoku/core'
import { addressKey, asEntityId, segmentAddressesOf } from '@shumoku/core'
import { timestamp } from '../db/index.js'
import { buildNetwork } from './contribution-store.js'
import type { ResolvedEntities, ResolvedRecord } from './resolved-record.js'

// ---------------------------------------------------------------------------
// ULID generator (synchronous - safe to call inside bun:sqlite transactions)
// ---------------------------------------------------------------------------

const BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier).
 * Uses crypto.randomBytes so it is safe to call within a DB transaction.
 * Exported for testability (§570: ULID unit tests).
 * Trust boundary: this is the ONE place entity ids are minted — returns EntityId.
 */
export function generateUlid(): EntityId {
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
  return asEntityId(timeChars.join('') + randChars.join(''))
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
  if (key === 'mgmtIp' || key === 'sysName' || key === 'mac') return NODE_KEY_CLASS.MUTABLE
  return NODE_KEY_CLASS.STRONG
}

function portKeyClass(key: string): PortKeyClass {
  if (key === 'ifName') return PORT_KEY_CLASS.PRIMARY
  if (key === 'mac') return PORT_KEY_CLASS.SECONDARY
  return PORT_KEY_CLASS.LAST_RESORT
}

/** SINGLETON keys: per-source value is replaced (not accumulated) on adopt. */
const SINGLETON_NODE_KEYS = new Set(['mgmtIp', 'sysName', 'mac'])
// ifName is PRIMARY but NOT singleton - replacing ifName re-keys the port. No port key is a
// singleton: a port's name and MAC are what it is recognized by.
const SINGLETON_PORT_KEYS = new Set<string>()

// ---------------------------------------------------------------------------
// Identity key gathering
// ---------------------------------------------------------------------------

interface IdentityKey {
  key: string
  value: string
}

/**
 * Gather node identity keys in priority order:
 * chassisId > vendorIds > address(es) > mac > sysName.
 * Falls back to `manual:<sourceId>` when the node has nothing it is recognized by.
 *
 * The keys are the node's device attributes from its configuration (`address`, the addresses
 * it holds in segments, `chassisId`, `sysName`, `mac`) and its source's own ids
 * (`observation.vendorIds`). `mac` belongs here because it is often the ONLY thing two sources
 * share: a wireless controller reports the switches its APs uplink into by chassis MAC and
 * nothing else, while a subnet sweep finds that same switch by address and reads its MAC out of
 * the ARP cache. Leaving it out let both sides store the same address and still mint separate
 * entities for one device.
 */
function gatherNodeKeys(keys: DeviceKeys, sourceId: string, nodeId: string): IdentityKey[] {
  const out: IdentityKey[] = []
  if (keys.chassisId) {
    out.push({ key: 'chassisId', value: normalizeKeyValue('chassisId', keys.chassisId) })
  }
  for (const [ns, v] of Object.entries(keys.vendorIds ?? {})) {
    out.push({ key: `vendor:${ns}`, value: normalizeKeyValue(`vendor:${ns}`, v) })
  }
  const addresses = new Set(
    [keys.address, ...(keys.addresses ?? [])].flatMap((a) => (a ? [addressKey(a)] : [])),
  )
  for (const address of addresses) {
    out.push({ key: 'mgmtIp', value: normalizeKeyValue('mgmtIp', address) })
  }
  if (keys.mac) {
    out.push({ key: 'mac', value: normalizeKeyValue('mac', keys.mac) })
  }
  if (keys.sysName) {
    out.push({ key: 'sysName', value: normalizeKeyValue('sysName', keys.sysName) })
  }
  if (out.length === 0) {
    out.push({ key: `manual:${sourceId}`, value: nodeId })
  }
  return out
}

/**
 * Gather port identity keys in priority order: ifName (the port's name) > mac. Every port has a
 * name, so the `manual:<sourceId>` fallback only guards a blank one.
 */
function gatherPortKeys(
  port: PortKeys,
  sourceId: string,
  macUses?: ReadonlyMap<string, number>,
): IdentityKey[] {
  const keys: IdentityKey[] = []
  if (port.name) {
    keys.push({ key: 'ifName', value: normalizeKeyValue('ifName', port.name) })
  }
  // A MAC several of the device's ports report names the device, not a port.
  if (port.mac && (macUses?.get(normalizeKeyValue('mac', port.mac)) ?? 1) === 1) {
    keys.push({ key: 'mac', value: normalizeKeyValue('mac', port.mac) })
  }
  if (keys.length === 0) {
    keys.push({ key: `manual:${sourceId}`, value: port.name })
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
export function resolveEntityAlias(entityId: EntityId, db: Database): EntityId {
  return resolveAlias(entityId, db)
}

function resolveAlias(entityId: EntityId, db: Database, depth = 0): EntityId {
  if (depth >= 8) return entityId
  const row = db
    .query<{ new_id: string }, [string]>('SELECT new_id FROM entity_alias WHERE old_id = ?')
    .get(entityId)
  if (!row) return entityId
  return resolveAlias(asEntityId(row.new_id), db, depth + 1)
}

// ---------------------------------------------------------------------------
// Candidate entity enrichment
// ---------------------------------------------------------------------------

/**
 * Only the rows of a source that still contributes to the topology take part in a lookup: legacy
 * rows (`source_id = ''`) and those whose source has a `contribution_source` row there (the
 * project's own included). Detaching a source cascades its contribution away, so the keys it
 * wrote stop matching at once, while the rows stay, so a re-attached source adopts its old
 * entities again and the metrics mappings bound to them hold. Without this, a detached source's
 * stale keys keep pulling a new source's devices into old entities.
 */
const LIVE_KEY = `(source_id = '' OR source_id IN (
  SELECT cs.source_id FROM contribution_source cs WHERE cs.topology_id = entity_identity_key.topology_id
))`

interface EntityKeyRow {
  key: string
  value: string
}

/** Load the identity keys stored for an entity by the sources that still contribute. */
function loadEntityKeys(
  topologyId: string,
  kind: string,
  parentId: string,
  entityId: EntityId,
  db: Database,
): Map<string, string[]> {
  const rows = db
    .query<EntityKeyRow, [string, string, string, string]>(
      `SELECT key, value FROM entity_identity_key
       WHERE topology_id = ? AND kind = ? AND parent_id = ? AND entity_id = ? AND ${LIVE_KEY}`,
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

/**
 * Merge-guard "strong" test, kind-aware:
 *   node: STRONG class keys (chassisId, vendor:*, manual:*)
 *   port: ifName (PRIMARY) or manual:* — mac (SECONDARY) and ifIndex (LAST_RESORT)
 *         are deliberately NOT strong here, so a mac-only or ifIndex-only
 *         multi-match can never auto-merge (spec: ifIndex must never trigger a merge).
 */
function isMergeStrongKey(key: string, kind: 'node' | 'port'): boolean {
  if (kind === 'node') return nodeKeyClass(key) === NODE_KEY_CLASS.STRONG
  return key === 'ifName' || key.startsWith('manual:')
}

function sharesStrongKey(
  obsKeys: IdentityKey[],
  entityKeys: Map<string, string[]>,
  kind: 'node' | 'port',
): boolean {
  for (const { key, value } of obsKeys) {
    if (!isMergeStrongKey(key, kind)) continue
    const entityValues = entityKeys.get(key)
    if (entityValues?.includes(value)) return true
  }
  return false
}

interface CandidateInfo {
  entityId: EntityId
  firstSeenAt: number
  entityKeys: Map<string, string[]>
  matchClass: NodeKeyClass | PortKeyClass
}

/**
 * Query entities matching any of the given keys (flat OR), counting only the keys of sources
 * that still contribute. Returns resolved unique ids.
 */
function queryCandidates(
  topologyId: string,
  kind: string,
  parentId: string,
  keys: IdentityKey[],
  db: Database,
): Array<{ entityId: EntityId; firstSeenAt: number }> {
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
       AND (${conditions}) AND ${LIVE_KEY}`,
    )
    .all(...params)

  const resolvedIds = new Set<EntityId>()
  for (const { entity_id } of rows) {
    // Trust boundary: DB read — entity_id values are ULIDs minted by generateUlid()
    resolvedIds.add(resolveAlias(asEntityId(entity_id), db))
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
  // Trust boundary: DB read — id values are ULIDs minted by generateUlid()
  return entities.map((e) => ({ entityId: asEntityId(e.id), firstSeenAt: e.first_seen_at }))
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

  // manual:* fallback — only ever gathered when the port has no network identity
  // at all, so it never coexists with the classes above. Without this stage an
  // identity-less port would mint a fresh entity on every sync.
  const manualObs = obsKeys.filter((k) => k.key.startsWith('manual:'))
  if (manualObs.length > 0) {
    const candidates = queryAndVetoCandidates(
      topologyId,
      'port',
      parentId,
      manualObs,
      obsKeys,
      'port',
      PORT_KEY_CLASS.PRIMARY,
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

/**
 * Per-source singleton-key replacement. For each SINGLETON key the source
 * reports, the source's view is "this entity, this value, nothing else":
 *   1. stale values for the SAME entity from this source are deleted
 *      (mgmtIp changed on the device);
 *   2. the SAME (key, value) held by a DIFFERENT entity from this source is
 *      released (an IP moved between devices — this is what kills the stale-IP
 *      magnet: the decommissioned entity loses the key the moment the source
 *      sees the value elsewhere).
 * Legacy rows (source_id = '', pre-migration-029) are treated as belonging to
 * whichever source claims them first — otherwise a pre-existing stale magnet
 * would survive the hardening forever. Rows written by OTHER sources are never
 * touched, so dual-homed multi-source truth is preserved.
 *
 * Called on BOTH adopt and mint: in the IP-reuse case the observation mints a
 * new entity, and the new entity is now the source's owner of that mgmtIp.
 */
function replaceSingletonKeys(
  topologyId: string,
  entityId: EntityId,
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
    // Delete stale values for this entity from this source or the legacy sentinel.
    db.query(
      `DELETE FROM entity_identity_key
       WHERE topology_id = ? AND entity_id = ? AND kind = ? AND parent_id = ?
         AND key = ? AND source_id IN (?, '') AND value != ?`,
    ).run(topologyId, entityId, kind, parentId, key, sourceId, value)
    // Release the same (key, value) from any OTHER entity (this source or legacy)
    // so the unique index allows us to claim it for this entity (IP moves, etc.).
    db.query(
      `DELETE FROM entity_identity_key
       WHERE topology_id = ? AND entity_id != ? AND kind = ? AND parent_id = ?
         AND key = ? AND value = ? AND source_id IN (?, '')`,
    ).run(topologyId, entityId, kind, parentId, key, value, sourceId)
  }
}

function insertIdentityKeys(
  topologyId: string,
  entityId: EntityId,
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
): EntityId {
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
    // Mint claims singleton keys too: after an IP reuse the vetoed old entity
    // must lose the source's mgmtIp row, or it stays a stale magnet.
    replaceSingletonKeys(topologyId, entityId, kind, parentId, keys, sourceId, singletonKeys, db)
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
  const guardKind = entityKind === 'port' ? 'port' : 'node'
  const allShareStrongKey = candidates.every((c) => sharesStrongKey(keys, c.entityKeys, guardKind))
  const allAgreeOn2Classes = candidates.every(
    (c) => countSharedKeyClasses(keys, c.entityKeys, guardKind) >= 2,
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

/** How many of a node's ports report each MAC. */
function macUsesOf(ports: ReadonlyArray<{ mac?: string | undefined }>): Map<string, number> {
  const uses = new Map<string, number>()
  for (const port of ports) {
    if (!port.mac) continue
    const mac = normalizeKeyValue('mac', port.mac)
    uses.set(mac, (uses.get(mac) ?? 0) + 1)
  }
  return uses
}

/**
 * Every port of a node, as the registry keys it: the ports the configuration writes, the ports
 * the observation describes and the ports a link end names, each with its `mac` when written.
 */
export function portsOf(
  node: inputModel.Node,
  observed: NonNullable<ObservationLayer['nodes']>[string] | undefined,
  links: readonly inputModel.Link[],
): PortKeys[] {
  const written = new Map((node.ports ?? []).map((p) => [p.name, p]))
  const names = new Set([...written.keys(), ...Object.keys(observed?.ports ?? {})])
  for (const link of links) {
    for (const end of link.endpoints) {
      if ('node' in end && end.node === node.id && end.port) names.add(end.port)
    }
  }
  return [...names].map((name) => {
    const port = written.get(name)
    const ifIndex = observed?.ports?.[name]?.ifIndex
    return {
      name,
      ...(port?.mac && { mac: port.mac }),
      ...(ifIndex !== undefined && { ifIndex }),
    }
  })
}

/** Remove what `sourceId` said about a node that its latest observation no longer says. */
function dropUnreportedNodeKeys(
  topologyId: string,
  entityId: EntityId,
  keys: IdentityKey[],
  sourceId: string,
  db: Database,
): void {
  const reported = new Set(keys.map((k) => `${k.key}\0${k.value}`))
  const stored = db
    .query<{ key: string; value: string }, [string, string, string]>(
      `SELECT key, value FROM entity_identity_key
       WHERE topology_id = ? AND entity_id = ? AND kind = 'node' AND source_id IN (?, '')`,
    )
    .all(topologyId, entityId, sourceId)
  for (const { key, value } of stored) {
    if (reported.has(`${key}\0${value}`)) continue
    db.query(
      `DELETE FROM entity_identity_key
       WHERE topology_id = ? AND entity_id = ? AND kind = 'node' AND key = ? AND value = ?
         AND source_id IN (?, '')`,
    ).run(topologyId, entityId, key, value, sourceId)
  }
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
  options: { complete?: boolean } = {},
): number {
  const contribution = buildNetwork(topologyId, sourceId, db)
  if (!contribution) return now
  const { network, observation } = contribution
  const addresses = segmentAddressesOf(network)

  const nodeEntityIds = new Map<string, EntityId>()
  const nodeKeysByEntity = new Map<EntityId, IdentityKey[]>()
  for (const node of network.nodes) {
    const keys = gatherNodeKeys(
      {
        ...node,
        addresses: addresses.get(node.id),
        vendorIds: observation?.nodes?.[node.id]?.vendorIds,
      },
      sourceId,
      node.id,
    )
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
    nodeKeysByEntity.set(entityId, [...(nodeKeysByEntity.get(entityId) ?? []), ...keys])
  }
  // Only a complete scan is evidence that a key the source used to report no longer holds.
  if (options.complete) {
    for (const [entityId, keys] of nodeKeysByEntity) {
      dropUnreportedNodeKeys(topologyId, entityId, keys, sourceId, db)
    }
  }

  const portEntityIds = new Map<string, EntityId>()
  for (const node of network.nodes) {
    const nodeEntityId = nodeEntityIds.get(node.id)
    if (!nodeEntityId) continue
    const ports = portsOf(node, observation?.nodes?.[node.id], network.links)
    const macUses = macUsesOf(ports)
    for (const port of ports) {
      const keys = gatherPortKeys(port, sourceId, macUses)
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
      portEntityIds.set(`${node.id}:${port.name}`, entityId)
    }
  }

  for (const link of network.links) {
    const [from, to] = link.endpoints
    // A link to a segment or a routing domain has no second port to key it by.
    if (!('node' in from) || !('node' in to)) continue
    const fromComposite = from.port ? `${from.node}:${from.port}` : undefined
    const toComposite = to.port ? `${to.node}:${to.port}` : undefined
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

  // Persist registry verdicts to entity_element so resolve() can use them as
  // first-class cluster keys (registry-driven fold). Full replacement per
  // (topology_id, source_id): DELETE existing rows then INSERT current verdicts.
  db.query('DELETE FROM entity_element WHERE topology_id = ? AND source_id = ?').run(
    topologyId,
    sourceId,
  )

  const insertElement = db.prepare(
    'INSERT INTO entity_element (topology_id, source_id, kind, local_id, entity_id) VALUES (?, ?, ?, ?, ?)',
  )
  for (const [nodeLocalId, entityId] of nodeEntityIds) {
    insertElement.run(topologyId, sourceId, 'node', nodeLocalId, entityId)
  }
  for (const [compositeKey, entityId] of portEntityIds) {
    insertElement.run(topologyId, sourceId, 'port', compositeKey, entityId)
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
// Public API - the entity ids of a resolved graph's elements (read-only registry access)
// ---------------------------------------------------------------------------

function lookupNodeEntityId(
  topologyId: string,
  keys: DeviceKeys,
  db: Database,
): EntityId | undefined {
  const gathered = gatherNodeKeys(keys, '', '').filter((k) => !k.key.startsWith('manual:'))
  if (gathered.length === 0) return undefined
  const candidates = stagedLookupNode(topologyId, '', gathered, db)
  return candidates[0]?.entityId
}

function lookupPortEntityId(
  topologyId: string,
  nodeEntityId: EntityId,
  port: PortKeys,
  db: Database,
): EntityId | undefined {
  const keys = gatherPortKeys(port, '').filter((k) => !k.key.startsWith('manual:'))
  if (keys.length === 0) return undefined
  const candidates = stagedLookupPort(topologyId, nodeEntityId, keys, db)
  return candidates[0]?.entityId
}

function lookupLinkEntityId(
  topologyId: string,
  portAEntityId: EntityId,
  portBEntityId: EntityId,
  db: Database,
): EntityId | undefined {
  const [pA, pB] = [portAEntityId, portBEntityId].sort()
  const keys: IdentityKey[] = [{ key: 'endpoints', value: `${pA}|${pB}` }]
  const candidates = flatLookupCandidates(topologyId, 'link', '', keys, db)
  return candidates[0]?.entityId
}

/**
 * The registry's entity ids for a resolved graph's nodes, ports and links, looked up by what each
 * element is recognized by: a node by its device attributes (`record.attributes`) and its sources'
 * ids (`record.observation`), a port by its name and `mac`, a link by its two port entities. Keyed
 * by the graph's element ids; an element the registry does not know is absent.
 */
export function stampEntityIds(
  topologyId: string,
  graph: NetworkGraph,
  record: Pick<ResolvedRecord, 'observation' | 'attributes'>,
  db: Database,
): ResolvedEntities {
  const entities: ResolvedEntities = { nodes: {}, ports: {}, links: {} }

  for (const node of graph.nodes) {
    const observed = record.observation.nodes?.[node.id]
    const nodeEntityId = lookupNodeEntityId(
      topologyId,
      { ...record.attributes[node.id], vendorIds: observed?.vendorIds },
      db,
    )
    if (!nodeEntityId) continue
    entities.nodes[node.id] = nodeEntityId
    for (const port of node.ports ?? []) {
      const portEntityId = lookupPortEntityId(
        topologyId,
        nodeEntityId,
        { name: port.id, ...(port.mac && { mac: port.mac }) },
        db,
      )
      if (portEntityId) entities.ports[`${node.id}:${port.id}`] = portEntityId
    }
  }

  for (const [i, link] of graph.links.entries()) {
    const fromKey = link.from.port ? `${link.from.node}:${link.from.port}` : undefined
    const toKey = link.to.port ? `${link.to.node}:${link.to.port}` : undefined
    const fromPortEntityId = fromKey ? entities.ports[fromKey] : undefined
    const toPortEntityId = toKey ? entities.ports[toKey] : undefined
    if (!fromPortEntityId || !toPortEntityId) continue
    const linkEntityId = lookupLinkEntityId(topologyId, fromPortEntityId, toPortEntityId, db)
    if (linkEntityId) entities.links[link.id || `link-${i}`] = linkEntityId
  }

  return entities
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

interface FlipMaps {
  /** old node id → new node id (entity id); only entries that actually change */
  nodeIdMap: Map<string, string>
  /** endpoint signature → new link id (entity id), for links that carry one */
  linkEntityByEndpoints: Map<string, string>
}

/** Build the flip maps from a graph and the entity ids the registry gave its elements. */
function buildFlipMaps(graph: NetworkGraph, entities: ResolvedEntities): FlipMaps {
  const nodeIdMap = new Map<string, string>()
  // Uniqueness guard: the registry can (correctly) unify two RESOLVED nodes as
  // one entity when resolve's fold didn't bridge them (e.g. a zabbix host node
  // and its LLDP-peer stub, chained through a NetBox observation). Flipping
  // BOTH to the same id collapses every id-keyed collection downstream — the
  // renderer draws one box and the other node silently vanishes (its ports,
  // keyed separately, keep rendering — the observed "node missing, ports
  // remain" defect). Until resolve folds registry-unified nodes into one
  // (registry-driven fold), only the FIRST node in graph order takes the
  // entity id; later claimants keep their original element id, stay visible,
  // and the disagreement is logged as the fold work-list.
  const claimed = new Map<string, string>()
  for (const n of graph.nodes) {
    const entityId = entities.nodes[n.id]
    if (!entityId || entityId === n.id) {
      if (entityId) claimed.set(entityId, n.id)
      continue
    }
    const holder = claimed.get(entityId)
    if (holder !== undefined) {
      console.warn(
        `[Registry] entity ${entityId} claimed by multiple resolved nodes ` +
          `(${holder}, ${n.id}) — resolve fold lags the registry; keeping ${n.id} un-flipped`,
      )
      continue
    }
    claimed.set(entityId, n.id)
    nodeIdMap.set(n.id, entityId)
  }
  const linkEntityByEndpoints = new Map<string, string>()
  // Same uniqueness guard for links: two resolved links (e.g. the same cable
  // observed by two sources with endpoints that didn't fold) can carry one
  // link entity. First claimant flips; later ones keep their element id.
  const claimedLinks = new Set<string>()
  for (const [i, l] of graph.links.entries()) {
    const entityId = entities.links[l.id || `link-${i}`]
    if (!entityId) continue
    if (claimedLinks.has(entityId)) {
      console.warn(
        `[Registry] link entity ${entityId} claimed by multiple resolved links — keeping later claimant un-flipped`,
      )
      continue
    }
    claimedLinks.add(entityId)
    linkEntityByEndpoints.set(endpointSignature(l.from, l.to), entityId)
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
  // Flip STRICTLY through the maps — buildFlipMaps enforces the uniqueness
  // guard (one node/link per entity id), so consulting the entities directly
  // here would reintroduce the duplicate-id collapse the guard exists for.
  const nodes = graph.nodes.map((n) => {
    const newId = maps.nodeIdMap.get(n.id)
    return newId !== undefined ? { ...n, id: newId } : n
  })
  const links = graph.links.map((l) => {
    const newId = maps.linkEntityByEndpoints.get(endpointSignature(l.from, l.to))
    return flipEmbeddedLink(l, newId, maps)
  })
  return { ...graph, nodes, links }
}

/**
 * Rewrite a drawn port's id when its node was flipped. A scene port's id starts with its node's id
 * (`node/port`, or `node#line` for a port a line made), so only that prefix moves.
 */
function flipScenePortId(id: string, nodeId: string, newNodeId: string): string {
  return nodeId === newNodeId || !id.startsWith(nodeId)
    ? id
    : `${newNodeId}${id.slice(nodeId.length)}`
}

/** Flip a drawn scene: node ids, the links' ids and endpoints, ports and hull members. */
function flipScene(scene: DrawingScene, maps: FlipMaps): DrawingScene {
  return {
    ...scene,
    nodes: scene.nodes.map((n) => {
      const id = mapNodeId(maps, n.node.id)
      return id === n.node.id ? n : { ...n, node: { ...n.node, id } }
    }),
    wires: scene.wires.map((w) => {
      const newId = maps.linkEntityByEndpoints.get(endpointSignature(w.link.from, w.link.to))
      return { ...w, link: flipEmbeddedLink(w.link, newId, maps) }
    }),
    ...(scene.ports && {
      ports: scene.ports.map((p) => {
        const nodeId = mapNodeId(maps, p.nodeId)
        return nodeId === p.nodeId
          ? p
          : { ...p, id: flipScenePortId(p.id, p.nodeId, nodeId), nodeId }
      }),
    }),
    ...(scene.hulls && {
      hulls: scene.hulls.map((h) => ({ ...h, members: h.members.map((m) => mapNodeId(maps, m)) })),
    }),
  }
}

/**
 * The Phase 3 flip: rewrite `node.id` / `link.id` on the resolved graph — AND the drawn scene
 * that shares those ids — to the stable entity ids `stampEntityIds` found. After this,
 * `node.id === entities.nodes[node.id]` and `link.id === entities.links[link.id]` for every element
 * the registry knows, so all downstream references (metrics mapping, weathermap data-ids, the
 * client viewer's graph↔scene join) key on a stable id. `port.id` is preserved; a scene port's id
 * keeps its name and only the node prefix moves. Graph and scene are flipped with ONE shared id
 * map so the baked artifact never disagrees with itself, and the maps are returned so the record
 * kept beside them is re-keyed the same way (`rekeyRecord`). Pure — never mutates.
 */
export function flipToEntityIds(
  graph: NetworkGraph,
  scene: DrawingScene,
  entities: ResolvedEntities,
): {
  graph: NetworkGraph
  scene: DrawingScene
  nodeIds: ReadonlyMap<string, string>
  linkIds: ReadonlyMap<string, string>
} {
  const maps = buildFlipMaps(graph, entities)
  const linkIds = new Map<string, string>()
  for (const [i, l] of graph.links.entries()) {
    const newId = maps.linkEntityByEndpoints.get(endpointSignature(l.from, l.to))
    const key = l.id || `link-${i}`
    if (newId !== undefined && newId !== key) linkIds.set(key, newId)
  }
  if (maps.nodeIdMap.size === 0 && maps.linkEntityByEndpoints.size === 0) {
    // Nothing stamped → nothing to flip (avoids needless copies of a big scene).
    return { graph, scene, nodeIds: maps.nodeIdMap, linkIds }
  }
  return {
    graph: flipGraph(graph, maps),
    scene: flipScene(scene, maps),
    nodeIds: maps.nodeIdMap,
    linkIds,
  }
}
