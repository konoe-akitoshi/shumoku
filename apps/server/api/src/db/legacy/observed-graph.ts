// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The graph shape contributions had until 2026-10 (one `NetworkGraph` per source, with
 * `identity`, `provenance`, attachments and `entityId` riding on its nodes, ports, links and
 * groups), and how it reads as a contribution of today's shape: a node's identity becomes the
 * configuration's `address` / `chassisId` / `sysName` / `mac`, a port's `ifName` its name and its
 * `mac` the port's, and the rest the observation record (`vendorIds`, `ifIndex`, provenance,
 * attachments). Read only by migration 034 (and by tests that still write fixtures in this shape);
 * nothing live produces it.
 */

import type {
  Attachment,
  Identity,
  inputModel,
  Link,
  LinkObservation,
  NetworkGraph,
  Node,
  NodeExclusion,
  NodeObservation,
  NodePort,
  ObservationLayer,
  PortObservation,
  SourceNetwork,
  Subgraph,
  SubgraphObservation,
} from '@shumoku/core'
import { fromNetworkGraph } from '@shumoku/core'

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

type NodeEntry = NonNullable<ObservationLayer['nodes']>[string]

function pick<T extends object>(fields: T): T | undefined {
  const set = Object.entries(fields).filter(([, v]) => v !== undefined)
  return set.length > 0 ? (Object.fromEntries(set) as T) : undefined
}

/** A port's name in the configuration's shape: its interface name when it carried one. */
const portName = (p: ObservedPort): string => p.identity?.ifName ?? p.id

/** Reads a graph of the old shape as a contribution of today's. */
export function observedGraphToSource(graph: ObservedGraph): SourceNetwork {
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
  const config: inputModel.Node[] = model.config.nodes.map((cfg) => {
    const n = graph.nodes.find((x) => x.id === cfg.id)
    if (!n) return cfg
    const id = n.identity
    const ports = Object.fromEntries(
      (n.ports ?? []).map((p) => [
        portName(p),
        pick<PortObservation>({
          provenance: p.provenance,
          attachments: p.attachments,
          suppressedAttachments: p.suppressedAttachments,
          entityId: p.entityId,
          ifIndex: p.identity?.ifIndex,
        }) ?? {},
      ]),
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
