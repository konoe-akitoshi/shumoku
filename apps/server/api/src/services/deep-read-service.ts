// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Deep-read orchestration — the server-side Discovery feature that reads known
 * devices over SNMP and folds what it learns back into the topology.
 *
 * The reading itself lives in `../discovery/deep-read`; this service is the
 * glue: it resolves each address's credential from `deep_read_config`, runs
 * the read, and records the result as an observation under the built-in
 * `deep-read` source so it merges (by chassis MAC / mgmtIp) with everything
 * else. It is what the Rescan button calls — no data-source plugin is
 * involved in an SNMP read.
 */

import { getTopologyService } from '../api/topologies.js'
import { getDatabase, timestamp } from '../db/index.js'
import { type DeepReadTarget, deepReadDevices } from '../discovery/deep-read.js'
import type { TopologyObservation } from './observations.js'
import { ObservationsService } from './observations.js'
import { resolveCredentialsForAutoscan } from './sync-scheduler.js'

/** The one built-in source every deep-read observation is written under. */
export const DEEP_READ_SOURCE_ID = 'deep-read'

/**
 * Deep-read outranks every attachable source: its readings are the device's
 * own answers over SNMP — authoritative device facts. Because the rank is
 * fixed (nothing to reorder), the deep-read rows are hidden from the Sources
 * listings; they exist only as contribution-ownership plumbing.
 */
const DEEP_READ_PRIORITY = 100

/**
 * Ensure the built-in deep-read source exists and is attached to the topology,
 * so its observations have a contribution to land in (contribution ownership
 * cascades off the attach row). Idempotent: safe to call before every read.
 * These rows are plumbing for a BUILT-IN — they are filtered out of the
 * sources APIs and never shown as an attachable data source.
 */
function ensureDeepReadAttachment(topologyId: string): void {
  const db = getDatabase()
  const now = timestamp()
  db.query(
    `INSERT OR IGNORE INTO data_sources (id, name, type, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(DEEP_READ_SOURCE_ID, 'Deep read (SNMP)', 'deep-read', '{}', now, now)

  const attachId = `deep-read-${topologyId}`
  const exists = db.query('SELECT 1 FROM topology_data_sources WHERE id = ?').get(attachId)
  if (!exists) {
    db.query(
      `INSERT INTO topology_data_sources
         (id, topology_id, data_source_id, purpose, priority, node_contribution, link_contribution, created_at, updated_at)
       VALUES (?, ?, ?, 'topology', ?, 'scoop', 'add', ?, ?)`,
    ).run(attachId, topologyId, DEEP_READ_SOURCE_ID, DEEP_READ_PRIORITY, now, now)
  }
}

/**
 * Read the given addresses over SNMP and record the result into the topology.
 * Addresses without a resolved credential are skipped (nothing to read them
 * with). Returns the recorded observation, or null when no address had a
 * credential.
 */
export async function runDeepRead(
  topologyId: string,
  addresses: string[],
): Promise<TopologyObservation | null> {
  // Credentials come from the Discovery feature's own per-node config table
  // (`deep_read_config`), keyed by entity and mapped here to mgmtIp. There is
  // deliberately no fallback: an address without a configured credential is
  // not readable, full stop.
  const perNode = await resolveCredentialsForAutoscan(topologyId, getTopologyService())
  const targets: DeepReadTarget[] = addresses
    .map((ip) => ({ ip, community: perNode[ip] }))
    .filter((t): t is { ip: string; community: string } => Boolean(t.community))
    .map((t) => ({ address: t.ip, community: t.community, timeoutMs: 1500 }))
  if (targets.length === 0) return null

  ensureDeepReadAttachment(topologyId)
  const result = await deepReadDevices(targets, DEEP_READ_SOURCE_ID)

  const observations = new ObservationsService()
  // A deep-read reads a subset; merge it into the source's prior snapshot so
  // reading three switches doesn't wipe the other twenty already known. Reuse
  // the same node-replace merge the probe path uses.
  const prev = observations
    .latestPerSource(topologyId)
    .find((o) => o.sourceId === DEEP_READ_SOURCE_ID)
  const merged = mergeReadIntoSnapshot(prev?.graph ?? null, result.graph, targets)

  return observations.record({
    topologyId,
    sourceId: DEEP_READ_SOURCE_ID,
    capturedAt: Date.now(),
    status: result.readCount === 0 ? 'empty' : result.partial ? 'partial' : 'ok',
    graph: merged,
  })
}

/**
 * Replace the just-read nodes (and their incident links) in the prior snapshot,
 * keeping every other device the deep-read has ever learned. Nodes are matched
 * by mgmtIp against the read targets; the read's own nodes and links are the
 * replacement.
 */
function mergeReadIntoSnapshot(
  prev: import('@shumoku/core').NetworkGraph | null,
  fresh: import('@shumoku/core').NetworkGraph,
  targets: DeepReadTarget[],
): import('@shumoku/core').NetworkGraph {
  if (!prev) return fresh
  const readIps = new Set(targets.map((t) => t.address))
  const freshIds = new Set(fresh.nodes.map((n) => n.id))
  // Keep prior nodes that were neither re-read (by mgmtIp) nor re-emitted (by id).
  const keptNodes = prev.nodes.filter(
    (n) => !(n.identity?.mgmtIp && readIps.has(n.identity.mgmtIp)) && !freshIds.has(n.id),
  )
  const keptIds = new Set([...keptNodes.map((n) => n.id), ...freshIds])
  const keptLinks = (prev.links ?? []).filter(
    (l) => keptIds.has(l.from.node) && keptIds.has(l.to.node),
  )
  return {
    version: fresh.version,
    nodes: [...keptNodes, ...fresh.nodes],
    links: [...keptLinks, ...(fresh.links ?? [])],
  }
}
