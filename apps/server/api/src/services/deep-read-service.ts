// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Deep-read orchestration — the server-side Discovery feature that reads known
 * devices over SNMP and folds what it learns back into the topology.
 *
 * The reading itself lives in `../discovery/deep-read`; this service is the
 * glue: it resolves each address's credential from the discovery policy, runs
 * the read, and records the result as an observation under a built-in
 * `discovery` source so it merges (by chassis MAC / mgmtIp) with everything
 * else. It is what the Rescan button and the scheduler call — no data-source
 * plugin is involved in an SNMP read.
 */

import { getTopologyService } from '../api/topologies.js'
import { getDatabase, timestamp } from '../db/index.js'
import { type DeepReadTarget, deepReadDevices } from '../discovery/deep-read.js'
import {
  resolveCredentialsForAutoscan,
  resolveTopologyDefaultCommunity,
} from './discovery-scheduler.js'
import type { TopologyObservation } from './observations.js'
import { ObservationsService } from './observations.js'

/** The one built-in source every deep-read observation is written under. */
export const DISCOVERY_SOURCE_ID = 'discovery'

/**
 * Ensure the built-in discovery source exists and is attached to the topology,
 * so its observations have a contribution to land in. Idempotent: safe to call
 * before every read. High priority (its readings are authoritative device
 * facts) with additive contribution so it enriches rather than scopes.
 */
function ensureDiscoveryAttachment(topologyId: string): void {
  const db = getDatabase()
  const now = timestamp()
  db.query(
    `INSERT OR IGNORE INTO data_sources (id, name, type, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(DISCOVERY_SOURCE_ID, 'Discovery (SNMP)', 'discovery', '{}', now, now)

  const attachId = `discovery-${topologyId}`
  const exists = db.query('SELECT 1 FROM topology_data_sources WHERE id = ?').get(attachId)
  if (!exists) {
    db.query(
      `INSERT INTO topology_data_sources
         (id, topology_id, data_source_id, purpose, priority, node_contribution, link_contribution, created_at, updated_at)
       VALUES (?, ?, ?, 'topology', 6, 'scoop', 'add', ?, ?)`,
    ).run(attachId, topologyId, DISCOVERY_SOURCE_ID, now, now)
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
  // A per-node access:snmp wins; otherwise the topology default applies — the
  // switch we want to read is usually an observed node with no authored overlay
  // entry, so its credential comes from the default, not a per-node one.
  const perNode = resolveCredentialsForAutoscan(topologyId, getTopologyService())
  const fallback = resolveTopologyDefaultCommunity(topologyId, getTopologyService())
  const targets: DeepReadTarget[] = addresses
    .map((ip) => ({ ip, community: perNode[ip] ?? fallback }))
    .filter((t): t is { ip: string; community: string } => Boolean(t.community))
    .map((t) => ({ address: t.ip, community: t.community, timeoutMs: 1500 }))
  if (targets.length === 0) return null

  ensureDiscoveryAttachment(topologyId)
  const result = await deepReadDevices(targets, DISCOVERY_SOURCE_ID)

  const observations = new ObservationsService()
  // A deep-read reads a subset; merge it into the source's prior snapshot so
  // reading three switches doesn't wipe the other twenty already known. Reuse
  // the same node-replace merge the probe path uses.
  const prev = observations
    .latestPerSource(topologyId)
    .find((o) => o.sourceId === DISCOVERY_SOURCE_ID)
  const merged = mergeReadIntoSnapshot(prev?.graph ?? null, result.graph, targets)

  return observations.record({
    topologyId,
    sourceId: DISCOVERY_SOURCE_ID,
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
