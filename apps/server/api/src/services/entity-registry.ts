// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Entity Registry — adopt-or-mint and entityId stamping.
 *
 * Called at **ingest time** (inside ObservationsService.record) to assign
 * stable ULIDs to every observed node / port / link.
 *
 * `stampEntityIds` is called in the host process after the derive worker
 * returns its resolved graph; it reads the registry (no writes) and adds
 * `entityId` to nodes, ports, and links.
 *
 * Key normalisation rules (documented for audit / test clarity):
 *   mgmtIp, mac, sysName → lowercase + trim
 *   chassisId, ifName    → trim only (preserve case — vendor strings / OS names)
 *   ifIndex              → string(number) (no case change)
 *   vendor:*, endpoints  → trim
 *   manual:<sourceId>    → trim (value is an element local id)
 *
 * parent_id sentinel: entity_identity_key.parent_id uses '' (empty string)
 * for node and link entities so UNIQUE constraints work under SQLite's
 * NULL-is-distinct behaviour.  Port entities use the parent node entity id.
 *
 * See apps/server/docs/design/topology-foundation-entity-registry.md §2.
 */

import type { Database } from 'bun:sqlite'
import { randomBytes } from 'node:crypto'
import type { Identity, Link, NetworkGraph, Node, NodePort } from '@shumoku/core'
import { timestamp } from '../db/index.js'
import { buildGraph } from './contribution-store.js'

// ---------------------------------------------------------------------------
// ULID generator (synchronous — safe to call inside bun:sqlite transactions)
// ---------------------------------------------------------------------------

const BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier).
 * Uses crypto.randomBytes so it is safe to call within a DB transaction.
 */
function generateUlid(): string {
  const t = Date.now()
  // Time part: 48-bit timestamp encoded as 10 Crockford base32 chars (50 bits, top 2 always 0)
  const timeChars: string[] = new Array(10)
  let ts = t
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = BASE32_CHARS[ts % 32] ?? '0'
    ts = Math.floor(ts / 32)
  }
  // Random part: 80 bits → 16 Crockford base32 chars
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
    // chassisId, ifName, ifIndex, vendor:*, manual:*, endpoints → trim only
    default:
      return trimmed
  }
}

// ---------------------------------------------------------------------------
// Identity key gathering
// ---------------------------------------------------------------------------

interface IdentityKey {
  key: string
  value: string
}

/**
 * Gather node identity keys in priority order: chassisId > mgmtIp > sysName > vendorIds.
 * Falls back to `manual:<sourceId>` when no network identity is available so
 * manually-authored nodes always get an entity.
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
  if (identity?.mgmtIp) {
    keys.push({ key: 'mgmtIp', value: normalizeKeyValue('mgmtIp', identity.mgmtIp) })
  }
  if (identity?.sysName) {
    keys.push({ key: 'sysName', value: normalizeKeyValue('sysName', identity.sysName) })
  }
  for (const [ns, v] of Object.entries(identity?.vendorIds ?? {})) {
    keys.push({ key: `vendor:${ns}`, value: normalizeKeyValue(`vendor:${ns}`, v) })
  }
  if (keys.length === 0) {
    // No network identity — fall back to source-local id so manual nodes
    // can still be tracked across re-ingests of the same source.
    keys.push({ key: `manual:${sourceId}`, value: nodeId })
  }
  return keys
}

/**
 * Gather port identity keys in priority order: ifName > mac > ifIndex.
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
  if (identity?.ifIndex !== undefined) {
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
 * Follow the alias chain for an entity id.  Caps at depth 8 to prevent
 * infinite loops from malformed data; in practice the chain is at most
 * 1-deep (one merge produces one alias row).
 *
 * Exported as {@link resolveEntityAlias} so reference tables keyed by entity id
 * (the metrics mapping in particular) can follow a merge: a row stored against a
 * pre-merge id keeps resolving to the survivor.
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
// Lookup
// ---------------------------------------------------------------------------

/**
 * Find the unique survivor entity ids for the given keys.  Resolves aliases
 * so the returned set never contains a merged-away id.
 *
 * parentId is '' for node/link entities and the node entity id for port entities
 * (see the parent_id sentinel note at the top of this file).
 */
function lookupByKeys(
  topologyId: string,
  kind: string,
  parentId: string,
  keys: IdentityKey[],
  db: Database,
): string[] {
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

  const resolved = new Set<string>()
  for (const { entity_id } of rows) {
    resolved.add(resolveAlias(entity_id, db))
  }
  return [...resolved]
}

// ---------------------------------------------------------------------------
// Core adopt-or-mint
// ---------------------------------------------------------------------------

/**
 * Adopt an existing entity (update last_seen_at, union new keys) or mint a
 * new one (INSERT + register keys).  When multiple entities match via
 * different keys, merge them: keep the oldest by first_seen_at, alias the
 * others, and union all keys onto the survivor.
 *
 * `parentId`       — empty string for node/link; node entity id for port
 *                    (stored in entity_identity_key.parent_id).
 * `entityParentId` — null for node/link; node entity id for port
 *                    (stored in entity_registry.parent_id, a nullable FK).
 */
function adoptOrMintEntity(
  topologyId: string,
  kind: string,
  parentId: string,
  entityParentId: string | null,
  keys: IdentityKey[],
  now: number,
  db: Database,
): string {
  const matchedIds = lookupByKeys(topologyId, kind, parentId, keys, db)

  if (matchedIds.length === 0) {
    // Mint
    const entityId = generateUlid()
    db.query(
      `INSERT INTO entity_registry
         (id, topology_id, kind, parent_id, status, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).run(entityId, topologyId, kind, entityParentId, now, now)
    for (const { key, value } of keys) {
      db.query(
        `INSERT OR IGNORE INTO entity_identity_key
           (topology_id, entity_id, kind, parent_id, key, value)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(topologyId, entityId, kind, parentId, key, value)
    }
    return entityId
  }

  if (matchedIds.length === 1) {
    // Adopt: update freshness + union new keys
    const entityId = matchedIds[0] as string
    db.query('UPDATE entity_registry SET last_seen_at = ? WHERE id = ?').run(now, entityId)
    for (const { key, value } of keys) {
      db.query(
        `INSERT OR IGNORE INTO entity_identity_key
           (topology_id, entity_id, kind, parent_id, key, value)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(topologyId, entityId, kind, parentId, key, value)
    }
    return entityId
  }

  // Merge: keep oldest (min first_seen_at, then lex id for determinism)
  const placeholders = matchedIds.map(() => '?').join(', ')
  const entities = db
    .query<{ id: string; first_seen_at: number }, string[]>(
      `SELECT id, first_seen_at FROM entity_registry
       WHERE id IN (${placeholders})
       ORDER BY first_seen_at ASC, id ASC`,
    )
    .all(...matchedIds)

  const survivor = entities[0]
  if (!survivor) {
    // Defensive: should never happen if lookupByKeys found entries
    return matchedIds[0] as string
  }
  const survivorId = survivor.id
  for (const other of entities.slice(1)) {
    db.query('INSERT OR IGNORE INTO entity_alias (old_id, new_id) VALUES (?, ?)').run(
      other.id,
      survivorId,
    )
  }
  // Refresh survivor + union ALL keys from the new observation
  db.query('UPDATE entity_registry SET last_seen_at = ? WHERE id = ?').run(now, survivorId)
  for (const { key, value } of keys) {
    db.query(
      `INSERT OR IGNORE INTO entity_identity_key
         (topology_id, entity_id, kind, parent_id, key, value)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(topologyId, survivorId, kind, parentId, key, value)
  }
  return survivorId
}

// ---------------------------------------------------------------------------
// Public API — adopt-or-mint for a whole graph
// ---------------------------------------------------------------------------

/**
 * Adopt-or-mint entity_registry rows for every node, port, and link in a
 * source's contribution.  Must be called after `ingestGraph` on the same DB
 * connection: it registers from the POST-INGEST contribution rows (read back
 * via `buildGraph`), never from the raw source graph.  This is deliberate —
 * NetBox-shaped sources enumerate no `ports[]` at all; their ports exist only
 * as link-endpoint strings and are synthesized as stub elements (with
 * `identity.ifName`, Phase 0) inside `ingestGraph`.  Reading back keeps that
 * synthesis the single source of truth instead of duplicating it here; a raw
 * graph would yield zero port entities and therefore zero link entities.
 *
 * Execution order:
 *   1. Nodes  — establishes node entityIds needed by ports.
 *   2. Ports  — parent-scoped; requires node entityId.
 *   3. Links  — endpoint port entityIds must be known first.
 */
export function adoptOrMintForGraph(topologyId: string, sourceId: string, db: Database): void {
  // No contribution rows for this (topology, source) → nothing to register.
  const graph = buildGraph(topologyId, sourceId, db)
  if (!graph) return
  const now = timestamp()

  // --- Nodes ---
  const nodeEntityIds = new Map<string, string>() // nodeLocalId → entityId
  for (const node of graph.nodes ?? []) {
    const keys = gatherNodeKeys(node.identity, sourceId, node.id)
    const entityId = adoptOrMintEntity(topologyId, 'node', '', null, keys, now, db)
    nodeEntityIds.set(node.id, entityId)
  }

  // --- Ports ---
  const portEntityIds = new Map<string, string>() // `${nodeId}:${portId}` → entityId
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
        now,
        db,
      )
      portEntityIds.set(`${node.id}:${port.id}`, entityId)
    }
  }

  // --- Links (canonical sorted endpoint pair → link entity) ---
  for (const link of graph.links ?? []) {
    const fromComposite = link.from.port ? `${link.from.node}:${link.from.port}` : undefined
    const toComposite = link.to.port ? `${link.to.node}:${link.to.port}` : undefined
    const fromPortEntityId = fromComposite ? portEntityIds.get(fromComposite) : undefined
    const toPortEntityId = toComposite ? portEntityIds.get(toComposite) : undefined
    if (!fromPortEntityId || !toPortEntityId) continue
    const [pA, pB] = [fromPortEntityId, toPortEntityId].sort()
    const linkKey: IdentityKey[] = [{ key: 'endpoints', value: `${pA}|${pB}` }]
    adoptOrMintEntity(topologyId, 'link', '', null, linkKey, now, db)
  }
}

// ---------------------------------------------------------------------------
// Public API — stamp entityId onto a resolved graph (read-only registry access)
// ---------------------------------------------------------------------------

function lookupNodeEntityId(
  topologyId: string,
  identity: Identity | undefined,
  db: Database,
): string | undefined {
  if (!identity) return undefined
  // Use gatherNodeKeys but strip manual fallback keys (source-specific, not useful for lookup)
  const keys = gatherNodeKeys(identity, '', '').filter((k) => !k.key.startsWith('manual:'))
  if (keys.length === 0) return undefined
  return lookupByKeys(topologyId, 'node', '', keys, db)[0]
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
  return lookupByKeys(topologyId, 'port', nodeEntityId, keys, db)[0]
}

function lookupLinkEntityId(
  topologyId: string,
  portAEntityId: string,
  portBEntityId: string,
  db: Database,
): string | undefined {
  const [pA, pB] = [portAEntityId, portBEntityId].sort()
  const keys: IdentityKey[] = [{ key: 'endpoints', value: `${pA}|${pB}` }]
  return lookupByKeys(topologyId, 'link', '', keys, db)[0]
}

/**
 * Stamp `entityId` on nodes, their ports, and links in the resolved graph.
 * Read-only: never writes to the registry.  Elements whose identity cannot
 * be resolved in the registry are returned unchanged (entityId omitted).
 *
 * Called by TopologyService.completeDerivation in the host process after the
 * derive worker returns its result.
 */
export function stampEntityIds(
  topologyId: string,
  graph: NetworkGraph,
  db: Database,
): NetworkGraph {
  const portEntityByNodePort = new Map<string, string>() // `${nodeId}:${portId}` → entityId

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
