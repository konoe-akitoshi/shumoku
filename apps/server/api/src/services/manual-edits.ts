// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Hand edits (a rename, a hide) written into a Manual source.
 *
 * The person is a source like any other, so what they say about a node is a node of a Manual
 * source's YAML: `{ id, label }` to rename, `{ id, absent: true }` to hide. Nothing is stored
 * anywhere else, and the server never finds or creates a Manual source on its own: the caller
 * names the one to write into.
 *
 * The GUI shows a device by its entity id, not by the id a Manual source gave a node. The node is
 * tied to the device by a registry key, `manual:<manualSourceId> = <yamlId>`, claimed before the
 * source's network is recorded, so that record's adopt lands on the device the person clicked
 * (a device that has no management address included). The result is exactly what the YAML editor
 * of that source shows.
 *
 * Whether the edit wins is not decided here: resolve picks by priority and knows nothing of
 * Manual. This only refuses (409) to write into a source that is not the top priority of the
 * topology's topology-purpose sources, because the edit would silently have no effect.
 */

import type { Database } from 'bun:sqlite'
import type { EntityId, inputModel } from '@shumoku/core'
import type {
  ManualEditInput,
  ManualEditResult,
  TopologySourceMutationResult,
} from '../app/services.js'
import type { DataSourceService } from './datasource.js'
import { claimNodeForSource, findNodeEntityById, releaseNodeClaim } from './entity-registry.js'
import type { ObservationsService } from './observations.js'
import { nameOfEntity, slug, uniqueId, withoutNetwork } from './project-overlay-removal.js'
import type { TopologyService } from './topology.js'
import type { TopologySourcesService } from './topology-sources.js'

type Node = inputModel.Node
type Network = inputModel.Network

export interface ManualEditDependencies {
  db: Database
  topologies: TopologyService
  sources: TopologySourcesService
  dataSources: DataSourceService
  observations: ObservationsService
}

type Result = TopologySourceMutationResult<ManualEditResult>

const failure = (
  status: 400 | 404 | 409 | 500,
  error: string,
  extra?: { reason: 'not-top-priority' | 'claim-conflict'; top?: string },
): Result => ({ ok: false, status, error, ...(extra && { extra }) })

/**
 * The attached topology-purpose source that outranks `sourceId`, if any. Priority is just the
 * attachment's value: a tie does not count as winning, because resolve breaks it by capture time.
 */
export function higherPrioritySource(
  sources: TopologySourcesService,
  topologyId: string,
  sourceId: string,
): string | null {
  const attached = sources
    .listByTopology(topologyId)
    .filter((s) => s.purpose === 'topology' && s.dataSourceId !== 'deep-read')
  const mine = attached.find((s) => s.dataSourceId === sourceId)
  if (!mine) return null
  let top: { id: string; priority: number } | null = null
  for (const other of attached) {
    if (other.dataSourceId === sourceId || other.priority < mine.priority) continue
    if (top === null || other.priority > top.priority) {
      top = { id: other.dataSourceId, priority: other.priority }
    }
  }
  return top?.id ?? null
}

/** The YAML node id of `entityId` in this Manual source, when its network holds one. */
function claimedYamlId(
  db: Database,
  topologyId: string,
  sourceId: string,
  entityId: EntityId,
  network: Network,
): string | null {
  const rows = db
    .query<{ local_id: string }, [string, string, string]>(
      `SELECT local_id FROM entity_element
       WHERE topology_id = ? AND source_id = ? AND entity_id = ? AND kind = 'node'`,
    )
    .all(topologyId, sourceId, entityId)
  for (const { local_id } of rows) {
    if (network.nodes.some((n) => n.id === local_id)) return local_id
  }
  return null
}

/** Whether a node says anything beyond "I exist". */
const hasFacts = (node: Node): boolean =>
  Object.entries(node).some(([k, v]) => k !== 'id' && v !== undefined)

/** `node` with `label` / `absent` applied; keeps every other field the person wrote. */
function applyFacts(node: Node, input: ManualEditInput): Node {
  const { label: _label, absent: _absent, ...rest } = node
  const label = input.label === undefined ? node.label : (input.label ?? undefined)
  const absent = input.absent === undefined ? node.absent : input.absent ? true : undefined
  return {
    ...rest,
    ...(label !== undefined && { label }),
    ...(absent !== undefined && { absent }),
  }
}

export async function editManualNode(
  deps: ManualEditDependencies,
  topologyId: string,
  manualSourceId: string,
  input: ManualEditInput,
): Promise<Result> {
  const { db, topologies, sources, dataSources, observations } = deps
  if (!topologies.get(topologyId)) return failure(404, 'Topology not found')

  const attached = sources.find(topologyId, manualSourceId, 'topology')
  if (!attached || dataSources.get(manualSourceId)?.type !== 'manual') {
    return failure(400, 'The source is not a Manual source attached to this topology')
  }
  const entityId = findNodeEntityById(topologyId, input.nodeId, db)
  if (!entityId) return failure(404, 'Node not found')

  const top = higherPrioritySource(sources, topologyId, manualSourceId)
  if (top) {
    return failure(
      409,
      'This Manual source is not the top priority, so the edit would have no effect',
      { reason: 'not-top-priority', top },
    )
  }

  const current = observations.getContribution(topologyId, manualSourceId)
  const network: Network = current?.network ?? { nodes: [], links: [] }
  const existingId = claimedYamlId(db, topologyId, manualSourceId, entityId, network)
  const existing = network.nodes.find((n) => n.id === existingId)

  let yamlId = existingId
  let next: Node | null
  if (existing) {
    const applied = applyFacts(existing, input)
    next = hasFacts(applied) ? applied : null
  } else {
    const applied = applyFacts({ id: '' }, input)
    if (!hasFacts(applied)) {
      // Undoing what was never written.
      return { ok: true, value: describe(manualSourceId, input.nodeId, null, null) }
    }
    yamlId = uniqueId(
      slug(applied.label ?? nameOfEntity(db, topologyId, entityId)),
      entityId,
      new Set(network.nodes.map((n) => n.id)),
    )
    next = { ...applied, id: yamlId }
  }

  // Tie the node to the device BEFORE the network is recorded, so the adopt lands on it.
  if (next && yamlId && !claimNodeForSource(topologyId, entityId, manualSourceId, yamlId, db)) {
    return failure(409, 'The node id is already tied to another device', {
      reason: 'claim-conflict',
    })
  }

  const nodes = network.nodes.flatMap((n) => (n.id !== yamlId ? [n] : next ? [next] : []))
  const recorded = await observations.record({
    topologyId,
    sourceId: manualSourceId,
    capturedAt: Date.now(),
    status: 'ok',
    source: {
      ...(current ? withoutNetwork(current) : {}),
      network: {
        ...network,
        nodes: existing || !next ? nodes : [...nodes, next],
      },
    },
  })
  if (recorded.status === 'failed') {
    return failure(500, recorded.statusMessage ?? 'The Manual source did not accept the edit')
  }
  if (!next && yamlId) releaseNodeClaim(topologyId, manualSourceId, yamlId, db)

  topologies.clearCacheEntry(topologyId)
  topologies.precompute(topologyId)
  return { ok: true, value: describe(manualSourceId, input.nodeId, next, yamlId) }
}

function describe(
  sourceId: string,
  nodeId: string,
  node: Node | null,
  yamlId: string | null,
): ManualEditResult {
  return {
    sourceId,
    nodeId,
    yamlId: node ? yamlId : null,
    label: node?.label ?? null,
    absent: node?.absent === true,
  }
}
