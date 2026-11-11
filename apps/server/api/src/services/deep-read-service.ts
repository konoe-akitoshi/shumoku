// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Deep-read orchestration — the server-side Discovery feature that reads known
 * devices over SNMP and folds what it learns back into the topology.
 *
 * The reading itself lives in `../discovery/deep-read`; this service is the
 * glue: it resolves each address's credential from the credentials its topology links, runs
 * the read, and records the result as an observation under the built-in
 * `deep-read` source so it merges (by chassis MAC / address) with everything
 * else. It is what the Rescan button calls — no data-source plugin is
 * involved in an SNMP read.
 */

import type { inputModel, SourceNetwork } from '@shumoku/core'
import { getDatabase, timestamp } from '../db/index.js'
import { trialDevices } from '../discovery/credential-trial.js'
import { type DeepReadTarget, deepReadDevices } from '../discovery/deep-read.js'
import { credentialsForTrial } from './credentials.js'
import {
  applyTrialResult,
  deviceNodes,
  type ReadOutcome,
  recordReadOutcomes,
  resolveReadTargets,
  resolveTrialCandidates,
} from './device-access.js'
import type { ObservationsService, TopologyObservation } from './observations.js'
import type { TopologyService } from './topology.js'

/** The one built-in source every deep-read observation is written under. */
export const DEEP_READ_SOURCE_ID = 'deep-read'

/**
 * Deep-read comes ahead of every attachable source in the order: its readings are the device's
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

/** What a read is about to do, so the operator can agree to it first. */
export interface ReadPlan {
  /** Devices that have no credential and will have the credentials tried on them. */
  toTry: number
  /** Credentials that will be tried (most-used first). */
  credentials: number
  /** Lost devices (their last read failed) that will be retried with the OTHER credentials. */
  retryLost: number
  /** At most this many SNMP requests are sent for the trial. */
  requests: number
  /** Devices that already hold a credential and will be read in full. */
  toRead: number
}

/** What the trial found. */
export interface TrialSummary {
  tried: number
  /** Devices that answered a credential — it is now on their row. */
  matched: number
  /** Devices that answered none of the credentials tried on them. */
  silent: number
}

/** What a read did: the recorded observation (null when nothing was readable),
 *  how each device's read went, and what the trial found. */
export interface DeepReadRun {
  observation: TopologyObservation | null
  outcomes: ReadOutcome[]
  trial: TrialSummary
  plan: ReadPlan
}

const NO_TRIAL: TrialSummary = { tried: 0, matched: 0, silent: 0 }

/**
 * Say what a read would do, without sending anything. A device named in
 * `entityIds` is tried even if it answered none of the credentials before (a
 * person asked for exactly that device); a broad read skips those until the
 * topology's credentials change. Null when the topology does not exist.
 */
export async function planDeepRead(
  topologyId: string,
  entityIds: readonly string[] | null,
  topologies: TopologyService,
): Promise<ReadPlan | null> {
  const parsed = await topologies.getParsed(topologyId)
  if (!parsed) return null
  const only = entityIds ? new Set(entityIds) : undefined
  const credentials = credentialsForTrial(topologyId).length
  const candidates =
    credentials > 0
      ? resolveTrialCandidates(topologyId, deviceNodes(parsed), { only, force: only !== undefined })
      : []
  const retryLost = candidates.filter((c) => c.skipCredentialId !== undefined).length
  const toTry = candidates.length - retryLost
  return {
    toTry,
    credentials,
    retryLost,
    requests: toTry * credentials + retryLost * Math.max(0, credentials - 1),
    toRead: resolveReadTargets(topologyId, deviceNodes(parsed), only).length,
  }
}

/**
 * Read devices over SNMP and record the result into the topology.
 *
 * Devices that have no credential yet are first tried with each credential the
 * topology links (see `discovery/credential-trial`); the one that answers is
 * written onto the device, and a device that answers none is remembered so it
 * is not tried again until the credentials change. A lost device (it had a
 * credential and the last read failed) is retried with the OTHER credentials
 * once the credentials have changed; if none answers it is left as it was.
 * Then every device holding a credential — including the ones just found — is
 * read in full. `entityIds` narrows the read to those devices; `null` reads
 * everything. There is deliberately no fallback credential. Returns null when
 * the topology does not exist.
 */
export async function runDeepRead(
  topologyId: string,
  entityIds: readonly string[] | null,
  topologies: TopologyService,
  observations: ObservationsService,
): Promise<DeepReadRun | null> {
  const plan = await planDeepRead(topologyId, entityIds, topologies)
  if (!plan) return null
  const parsed = await topologies.getParsed(topologyId)
  if (!parsed) return null
  const only = entityIds ? new Set(entityIds) : undefined

  let trial = NO_TRIAL
  if (plan.toTry + plan.retryLost > 0) {
    const candidates = resolveTrialCandidates(topologyId, deviceNodes(parsed), {
      only,
      force: only !== undefined,
    })
    const found = await trialDevices(candidates, credentialsForTrial(topologyId))
    const retrying = new Set(
      candidates.filter((c) => c.skipCredentialId !== undefined).map((c) => c.entityId),
    )
    applyTrialResult(
      topologyId,
      { matched: found.matched, silent: found.silent.filter((id) => !retrying.has(id)) },
      Date.now(),
    )
    trial = { tried: candidates.length, matched: found.matched.length, silent: found.silent.length }
  }

  const readable = resolveReadTargets(topologyId, deviceNodes(parsed), only)
  if (readable.length === 0) return { observation: null, outcomes: [], trial, plan }
  const targets: DeepReadTarget[] = readable.map((t) => ({
    address: t.address,
    community: t.community,
    timeoutMs: 1500,
  }))

  ensureDeepReadAttachment(topologyId)
  const result = await deepReadDevices(targets, DEEP_READ_SOURCE_ID)

  const entityByAddress = new Map(readable.map((t) => [t.address, t.entityId]))
  const outcomes: ReadOutcome[] = result.outcomes.flatMap((o) => {
    const entityId = entityByAddress.get(o.address)
    return entityId ? [{ entityId, status: o.status, ...(o.error ? { error: o.error } : {}) }] : []
  })
  recordReadOutcomes(topologyId, outcomes, Date.now())

  // A deep-read reads a subset; merge it into the source's prior snapshot so
  // reading three switches doesn't wipe the other twenty already known. Reuse
  // the same node-replace merge the probe path uses.
  const prior = observations.getContribution(topologyId, DEEP_READ_SOURCE_ID)
  const merged = mergeReadIntoSnapshot(prior, result.source, new Set(result.linksRead))

  const observation = await observations.record({
    topologyId,
    sourceId: DEEP_READ_SOURCE_ID,
    capturedAt: Date.now(),
    status: result.partial ? 'partial' : result.readCount === 0 ? 'empty' : 'ok',
    source: merged,
  })
  return { observation, outcomes, trial, plan }
}

/** The entries of a layer record whose key is kept. */
function pick<T>(
  record: Readonly<Record<string, T>> | undefined,
  keep: (key: string) => boolean,
): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [key, value] of Object.entries(record ?? {})) {
    if (keep(key)) out[key] = value
  }
  return out
}

/** The ids of a link's node ends. */
function nodeEnds(link: inputModel.Link): string[] {
  return link.endpoints.flatMap((end) => ('node' in end ? [end.node] : []))
}

/**
 * Replace the devices that answered in the prior snapshot, keeping every other device the
 * deep-read has ever learned. A device's prior links are replaced only when its LLDP table was
 * read. Each node's and link's observation and drawing entries follow it.
 */
export function mergeReadIntoSnapshot(
  prev: SourceNetwork | null,
  fresh: SourceNetwork,
  linksRead: ReadonlySet<string>,
): SourceNetwork {
  if (!prev) return fresh
  const answeredIps = new Set(fresh.network.nodes.flatMap((n) => (n.address ? [n.address] : [])))
  const freshNodeIds = new Set(fresh.network.nodes.map((n) => n.id))
  const freshLinkIds = new Set(fresh.network.links.flatMap((l) => (l.id ? [l.id] : [])))
  // Keep prior nodes that were neither re-read (by address) nor re-emitted (by id).
  const keptNodes = prev.network.nodes.filter(
    (n) => !(n.address && answeredIps.has(n.address)) && !freshNodeIds.has(n.id),
  )
  const keptNodeIds = new Set([...keptNodes.map((n) => n.id), ...freshNodeIds])
  // Keep prior links between surviving nodes that no device with a fresh LLDP table ends.
  const keptLinks = prev.network.links.filter(
    (l) =>
      !(l.id && freshLinkIds.has(l.id)) &&
      nodeEnds(l).every((id) => keptNodeIds.has(id) && !linksRead.has(id)),
  )
  const keepNode = (id: string) => !freshNodeIds.has(id) && keptNodes.some((n) => n.id === id)
  const keepLink = (id: string) => keptLinks.some((l) => l.id === id)

  const mergeNodes = <T>(
    prior: Readonly<Record<string, T>> | undefined,
    read: Readonly<Record<string, T>> | undefined,
  ): Record<string, T> => ({ ...pick(prior, keepNode), ...read })
  const mergeLinks = <T>(
    prior: Readonly<Record<string, T>> | undefined,
    read: Readonly<Record<string, T>> | undefined,
  ): Record<string, T> => ({ ...pick(prior, keepLink), ...read })

  const drawingNodes = mergeNodes(prev.drawing?.nodes, fresh.drawing?.nodes)
  const drawingLinks = mergeLinks(prev.drawing?.links, fresh.drawing?.links)
  const hasDrawing = Object.keys(drawingNodes).length > 0 || Object.keys(drawingLinks).length > 0
  return {
    network: {
      nodes: [...keptNodes, ...fresh.network.nodes],
      links: [...keptLinks, ...fresh.network.links],
    },
    observation: {
      nodes: mergeNodes(prev.observation?.nodes, fresh.observation?.nodes),
      links: mergeLinks(prev.observation?.links, fresh.observation?.links),
    },
    ...(hasDrawing ? { drawing: { nodes: drawingNodes, links: drawingLinks } } : {}),
  }
}
