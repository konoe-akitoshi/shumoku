// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The record the Server keeps beside a baked graph. The drawn graph carries no identity,
 * provenance or attachments; what the merge said of each element (`ObservationLayer`), the
 * attributes each device is recognized by (its configuration's `address`, `chassisId`, `sysName`,
 * `mac`) and the entity ids the registry gave them live here, keyed by the ids the graph is served
 * with. Server features read this record, never the graph, for identity.
 */

import type {
  DeviceKeys,
  EntityId,
  NetworkModel,
  ObservationLayer,
  SubgraphObservation,
} from '@shumoku/core'
import { segmentAddressesOf } from '@shumoku/core'

/** What a merged node is recognized by: its configuration's attributes and segment addresses. */
export type DeviceAttributes = Omit<DeviceKeys, 'vendorIds'>

export interface ResolvedEntities {
  /** Node element id → entity id. After the id flip the two agree for every flipped node. */
  nodes: Record<string, EntityId>
  /** `${nodeId}:${portName}` → entity id. */
  ports: Record<string, EntityId>
  /** Link key (`link.id || link-${i}`) → entity id. */
  links: Record<string, EntityId>
}

export interface ResolvedRecord {
  /** The merge's record: provenance, attachments, a source's own ids, per element. */
  observation: ObservationLayer
  /** Each node's device attributes from the merged configuration, by node id. */
  attributes: Record<string, DeviceAttributes>
  entities: ResolvedEntities
}

type NodeEntry = NonNullable<ObservationLayer['nodes']>[string]
type LinkEntry = NonNullable<ObservationLayer['links']>[string]

/** The device attributes of every node of a merged model, by node id. */
export function deviceAttributesOf(model: NetworkModel): Record<string, DeviceAttributes> {
  const addresses = segmentAddressesOf(model.config)
  const out: Record<string, DeviceAttributes> = {}
  for (const node of model.config.nodes) {
    const held = addresses.get(node.id)
    out[node.id] = {
      ...(node.address && { address: node.address }),
      ...(held && held.length > 0 && { addresses: held }),
      ...(node.chassisId && { chassisId: node.chassisId }),
      ...(node.sysName && { sysName: node.sysName }),
      ...(node.mac && { mac: node.mac }),
    }
  }
  return out
}

function rekey<T>(
  record: Readonly<Record<string, T>> | undefined,
  map: ReadonlyMap<string, string>,
): Record<string, T> | undefined {
  if (!record) return undefined
  return Object.fromEntries(Object.entries(record).map(([id, v]) => [map.get(id) ?? id, v]))
}

/**
 * The record keyed by the ids a graph is served with, after `flipToEntityIds` moved node and link
 * ids to their entity ids. `nodeIds` / `linkIds` map old id → new id for the elements that moved.
 */
export function rekeyRecord(
  record: ResolvedRecord,
  nodeIds: ReadonlyMap<string, string>,
  linkIds: ReadonlyMap<string, string>,
): ResolvedRecord {
  if (nodeIds.size === 0 && linkIds.size === 0) return record
  const nodes = rekey<NodeEntry>(record.observation.nodes, nodeIds)
  const links = rekey<LinkEntry>(record.observation.links, linkIds)
  const groups: Record<string, SubgraphObservation> | undefined = record.observation.groups
    ? { ...record.observation.groups }
    : undefined
  const ports = Object.fromEntries(
    Object.entries(record.entities.ports).map(([key, entityId]) => {
      const sep = key.indexOf(':')
      if (sep < 0) return [key, entityId]
      const nodeId = key.slice(0, sep)
      return [`${nodeIds.get(nodeId) ?? nodeId}${key.slice(sep)}`, entityId]
    }),
  )
  return {
    observation: {
      ...record.observation,
      ...(nodes && { nodes }),
      ...(links && { links }),
      ...(groups && { groups }),
    },
    attributes: rekey(record.attributes, nodeIds) ?? {},
    entities: {
      nodes: rekey(record.entities.nodes, nodeIds) ?? {},
      ports,
      links: rekey(record.entities.links, linkIds) ?? {},
    },
  }
}
