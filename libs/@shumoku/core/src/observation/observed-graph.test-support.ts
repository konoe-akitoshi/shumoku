// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Test support: the graph shape contributions had until the device attributes moved into the
 * configuration (2026-11), when `identity`, `provenance` and attachments rode on the drawn graph's
 * nodes and ports. The merge tests were written against it; this module translates such a graph
 * into a `SourceNetwork` (identity → the node's `address` / `chassisId` / `sysName` / `mac`, a
 * port's `ifName` → its name, the rest → the observation record) and joins the merged record back
 * onto the drawn graph so the assertions read as before. Not built or published.
 */

import type { ObservationLayer, SourceNetwork } from '../models/network-model.js'
import { fromNetworkGraph } from '../models/network-model-from-graph.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import type {
  Attachment,
  Identity,
  Link,
  LinkObservation,
  NetworkGraph,
  Node,
  NodeExclusion,
  NodeObservation,
  NodePort,
  PortObservation,
  Subgraph,
  SubgraphObservation,
} from '../models/types.js'
import { type ResolvedNetwork, resolveNetwork, type SourceSnapshot } from './resolve-network.js'
import type { ResolveOptions } from './types.js'

export interface ObservedPort extends NodePort, Omit<PortObservation, 'ifIndex'> {
  identity?: Identity
}
export interface ObservedNode extends Node, Omit<NodeObservation, 'vendorIds'> {
  identity?: Identity
  metadata?: Record<string, unknown>
  ports?: ObservedPort[]
}
export interface ObservedLink extends Link, LinkObservation {
  metadata?: Record<string, unknown>
}
export interface ObservedSubgraph extends Subgraph, SubgraphObservation {}
export interface ObservedGraph extends NetworkGraph {
  nodes: ObservedNode[]
  links: ObservedLink[]
  subgraphs?: ObservedSubgraph[]
  attachments?: Attachment[]
  exclusions?: NodeExclusion[]
}

export interface SnapshotEntry extends Omit<SourceSnapshot, 'source'> {
  graph: ObservedGraph | null
}

type NodeEntry = NonNullable<ObservationLayer['nodes']>[string]

function pick<T extends object>(fields: T): T | undefined {
  const set = Object.entries(fields).filter(([, v]) => v !== undefined)
  return set.length > 0 ? (Object.fromEntries(set) as T) : undefined
}

/** A port's name in the configuration's shape: its interface name when it has one. */
const portName = (p: ObservedPort): string => p.identity?.ifName ?? p.id

/** Splits a graph of the old shape into a contribution. */
export function graphToSource(graph: ObservedGraph): SourceNetwork {
  const renamed: NetworkGraph = {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      // Only what the configuration's port says: the record rides apart.
      ports: n.ports?.map((p) => {
        const {
          identity,
          provenance: _p,
          attachments: _a,
          suppressedAttachments: _s,
          entityId: _e,
          ...port
        } = p
        return { ...port, id: portName(p), ...(identity?.mac && { mac: identity.mac }) }
      }),
    })),
    links: graph.links.map((l) => {
      const rename = (end: Link['from']) => {
        const port = graph.nodes
          .find((n) => n.id === end.node)
          ?.ports?.find((p) => p.id === end.port)
        return port ? { ...end, port: portName(port) } : end
      }
      return { ...l, from: rename(l.from), to: rename(l.to) }
    }),
  }
  const model = fromNetworkGraph(renamed)
  const nodes: Record<string, NodeEntry> = {}
  const config = model.config.nodes.map((cfg) => {
    const n = graph.nodes.find((x) => x.id === cfg.id)
    if (!n) return cfg
    const id = n.identity
    const ports = Object.fromEntries(
      (n.ports ?? []).flatMap((p) => {
        const entry = pick<PortObservation>({
          provenance: p.provenance,
          attachments: p.attachments,
          suppressedAttachments: p.suppressedAttachments,
          entityId: p.entityId,
          ifIndex: p.identity?.ifIndex,
        })
        return entry ? [[portName(p), entry]] : [[portName(p), {}]]
      }),
    )
    const entry = pick<NodeEntry>({
      presence: n.presence,
      provenance: n.provenance,
      attachments: n.attachments,
      suppressedAttachments: n.suppressedAttachments,
      entityId: n.entityId,
      metadata: n.metadata,
      vendorIds: id?.vendorIds,
      ports: Object.keys(ports).length > 0 ? ports : undefined,
    })
    if (entry) nodes[n.id] = entry
    return {
      ...cfg,
      ...(id?.mgmtIp && { address: id.mgmtIp }),
      ...(id?.chassisId && { chassisId: id.chassisId }),
      ...(id?.sysName && { sysName: id.sysName }),
      ...(id?.mac && { mac: id.mac }),
    }
  })
  const links: Record<string, NonNullable<ObservationLayer['links']>[string]> = {}
  for (const [i, l] of graph.links.entries()) {
    const entry = pick({
      presence: l.presence,
      provenance: l.provenance,
      entityId: l.entityId,
      metadata: l.metadata,
    })
    if (entry) links[l.id ?? `link-${i}`] = entry
  }
  const groups: Record<string, SubgraphObservation> = {}
  for (const sg of graph.subgraphs ?? []) {
    const { identity, scope, provenance, attachments } = sg
    const entry = pick({ identity, scope, provenance, attachments })
    if (entry) groups[sg.id] = entry
  }
  const observation = pick<ObservationLayer>({
    nodes: Object.keys(nodes).length > 0 ? nodes : undefined,
    links: Object.keys(links).length > 0 ? links : undefined,
    groups: Object.keys(groups).length > 0 ? groups : undefined,
    attachments: graph.attachments,
    exclusions: graph.exclusions,
  })
  return {
    network: {
      ...model.config,
      nodes: config,
      // A link's layers are keyed by its id; one without an id gets its positional key.
      links: model.config.links.map((l, i) => (links[`link-${i}`] ? { ...l, id: `link-${i}` } : l)),
    },
    ...(observation && { observation }),
    ...(model.drawing && { drawing: model.drawing }),
  }
}

/** The observation record of a graph of the old shape. */
export function observationOf(graph: ObservedGraph): ObservationLayer | undefined {
  return graphToSource(graph).observation
}

/** Joins a merged record back onto its drawn graph, in the old shape. */
export function joinRecord({ model, observation }: ResolvedNetwork): ObservedGraph {
  const graph = toNetworkGraph(model)
  const identityOf = (id: string): Identity | undefined => {
    const cfg = model.config.nodes.find((n) => n.id === id)
    return pick<Identity>({
      mgmtIp: cfg?.address,
      chassisId: cfg?.chassisId,
      sysName: cfg?.sysName,
      mac: cfg?.mac,
      vendorIds: observation.nodes?.[id]?.vendorIds,
    })
  }
  return {
    ...graph,
    nodes: graph.nodes.map((n): ObservedNode => {
      const { ports: observedPorts, vendorIds: _v, ...rest } = observation.nodes?.[n.id] ?? {}
      const identity = identityOf(n.id)
      const names = new Set([
        ...(n.ports ?? []).map((p) => p.id),
        ...Object.keys(observedPorts ?? {}),
      ])
      const ports = [...names].map((name): ObservedPort => {
        const drawn = n.ports?.find((p) => p.id === name) ?? {
          id: name,
          label: name,
          connectors: [],
        }
        const { ifIndex, ...observed } = observedPorts?.[name] ?? {}
        return {
          ...drawn,
          ...observed,
          identity: {
            ifName: name,
            ...(drawn.mac && { mac: drawn.mac }),
            ...(ifIndex !== undefined && { ifIndex }),
          },
        }
      })
      return { ...n, ...rest, ...(identity && { identity }), ...(ports.length > 0 && { ports }) }
    }),
    links: graph.links.map(
      (l, i): ObservedLink => ({
        ...l,
        ...observation.links?.[l.id ?? `link-${i}`],
      }),
    ),
    ...(graph.subgraphs && {
      subgraphs: graph.subgraphs.map((sg) => ({ ...sg, ...observation.groups?.[sg.id] })),
    }),
    ...(observation.attachments && { attachments: [...observation.attachments] }),
    ...(observation.exclusions && { exclusions: [...observation.exclusions] }),
  }
}

/** Merges graphs of the old shape through `resolveNetwork` and returns the merged graph. */
export function resolve(
  authored: ObservedGraph,
  snapshots: SnapshotEntry[],
  options: ResolveOptions = {},
): ObservedGraph {
  return joinRecord(
    resolveNetwork(
      graphToSource(authored),
      snapshots.map(({ graph, ...snap }) => ({
        ...snap,
        source: graph ? graphToSource(graph) : null,
      })),
      options,
    ),
  )
}
