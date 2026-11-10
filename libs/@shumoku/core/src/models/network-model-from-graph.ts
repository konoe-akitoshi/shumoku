// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import yaml from 'js-yaml'
import type * as input from '../input/model.js'
import type {
  DrawingLayer,
  NetworkModel,
  ObservationLayer,
  ObservedModel,
  SourceNetwork,
} from './network-model.js'
import { getStandardSpec } from './standards.js'
import {
  DeviceType,
  type Link,
  type NetworkGraph,
  type Node,
  type NodePort,
  type Subgraph,
} from './types.js'

/** Writes a model's configuration as the network YAML. Its drawing is not written. */
export function writeNetworkModel(model: NetworkModel): string {
  return yaml.dump(model.config, { lineWidth: 100, noRefs: true })
}

type Entry<T> = NonNullable<T>[string & keyof NonNullable<T>]

/**
 * Splits a drawn graph back into a model and the observation record beside it: the inverse of
 * `toNetworkGraph` for what the configuration can say. A node drawn for a segment becomes the
 * segment again.
 */
export function fromNetworkGraph(graph: NetworkGraph): ObservedModel {
  const isSegment = (n: Node) => n.spec?.kind !== 'service' && n.spec?.type === DeviceType.Segment
  const segmentIds = new Set(graph.nodes.filter(isSegment).map((n) => n.id))
  const vlanSegments = new Map<number, input.Segment>()
  const linkSegments: input.Segment[] = []
  const redundancy: input.Redundancy[] = []
  const observed = {
    nodes: {} as Record<string, Entry<ObservationLayer['nodes']>>,
    links: {} as Record<string, Entry<ObservationLayer['links']>>,
    groups: {} as Record<string, Entry<ObservationLayer['groups']>>,
  }
  const drawn = {
    nodes: {} as Record<string, Entry<DrawingLayer['nodes']>>,
    links: {} as Record<string, Entry<DrawingLayer['links']>>,
    groups: {} as Record<string, Entry<DrawingLayer['groups']>>,
  }

  const nodes = graph.nodes.filter((n) => !isSegment(n)).map(toConfigNode)
  const links = graph.links.map(toConfigLink)
  const segments = [
    ...graph.nodes.filter(isSegment).map(
      (n): input.Segment => ({
        id: n.id,
        ...(typeof n.label === 'string' && n.label !== n.id && { label: n.label }),
        ...(n.parent && { group: n.parent }),
      }),
    ),
    ...vlanSegments.values(),
    ...linkSegments,
  ]
  const groups = nestGroups(graph.subgraphs ?? [])
  for (const sg of graph.subgraphs ?? []) {
    const { identity, scope, provenance, attachments } = sg
    const observation = pick({ identity, scope, provenance, attachments })
    if (observation) observed.groups[sg.id] = observation
    const { style, spec } = sg
    const drawing = pick({ style, spec })
    if (drawing) drawn.groups[sg.id] = drawing
  }
  const terminations = (graph.terminations ?? []).map(
    (t): input.Termination => ({
      id: t.id,
      ...(t.label && t.label !== t.id && { label: t.label }),
      role: t.role,
      ...(t.autoFor && { autoFor: t.autoFor }),
    }),
  )

  const observation = pick({
    nodes: nonEmpty(observed.nodes),
    links: nonEmpty(observed.links),
    groups: nonEmpty(observed.groups),
    attachments: graph.attachments,
    exclusions: graph.exclusions,
  })
  const drawing = pick({
    nodes: nonEmpty(drawn.nodes),
    links: nonEmpty(drawn.links),
    groups: nonEmpty(drawn.groups),
    settings: graph.settings,
  })

  const config: input.Network = {
    ...(graph.name && { name: graph.name }),
    ...(graph.description && { description: graph.description }),
    ...(groups.length > 0 && { groups }),
    ...(segments.length > 0 && { segments }),
    ...(redundancy.length > 0 && { redundancy }),
    nodes,
    links,
    ...(terminations.length > 0 && { terminations }),
  }
  return {
    model: { config, ...(drawing && { drawing }) },
    ...(observation && { observation }),
  }

  function toConfigNode(node: Node): input.Node {
    const spec = node.spec
    const vendor = spec?.vendor
    const model = spec?.kind === 'hardware' ? spec.model : undefined
    const product = model ? `${vendor ?? '?'}/${model}` : vendor
    const label = Array.isArray(node.label) ? node.label[0] : node.label

    const { presence, provenance, identity, attachments } = node
    const { suppressedAttachments, entityId, metadata } = node
    const portObservation = byPort(node.ports, (p) => {
      const { provenance, identity, attachments, suppressedAttachments, entityId } = p
      return pick({ provenance, identity, attachments, suppressedAttachments, entityId })
    })
    const nodeObserved = pick({
      presence,
      provenance,
      identity,
      attachments,
      suppressedAttachments,
      entityId,
      metadata,
      ports: portObservation,
    })
    if (nodeObserved) observed.nodes[node.id] = nodeObserved

    const { shape, style } = node
    const nodeDrawn = pick({ shape, style, icon: spec?.icon })
    if (nodeDrawn) drawn.nodes[node.id] = nodeDrawn

    const ports = (node.ports ?? []).flatMap((p) => {
      const port = toConfigPort(p)
      return port ? [port] : []
    })
    return {
      id: node.id,
      ...(label && { label }),
      ...(spec?.kind !== 'service' && spec?.type && { type: spec.type }),
      ...(product && { product }),
      ...(node.productId && { productId: node.productId }),
      ...(spec?.kind === 'compute' && spec.platform && { platform: spec.platform }),
      ...(spec?.kind === 'service' && { service: spec.service }),
      ...(spec?.kind === 'service' && spec.resource && { resource: spec.resource }),
      ...(node.parent && { group: node.parent }),
      ...(node.host && { host: node.host }),
      ...(ports.length > 0 && { ports }),
    }
  }

  /** A port made only from a link end's name says nothing the link does not, so it is not written. */
  function toConfigPort(port: NodePort): input.Port | undefined {
    const { id } = port
    const { entityId: _e, label, connectors, aliases, ...rest } = withoutObservation(port)
    const fields = pick<Omit<input.Port, 'name'>>({
      ...rest,
      ...(label !== undefined && label !== id && { label }),
      ...(connectors?.length > 0 && { connectors }),
      ...(aliases?.length && { aliases }),
    })
    return fields ? { name: id, ...fields } : undefined
  }

  function toConfigLink(link: Link, index: number): input.Link {
    const id = link.id ?? `link-${index}`
    const end = (e: Link['from']): input.Endpoint =>
      segmentIds.has(e.node)
        ? { segment: e.node }
        : { node: e.node, ...(e.port && { port: e.port }), ...(e.plug && { plug: e.plug }) }
    const segments = (link.vlan ?? []).map((vlan) => {
      const existing = vlanSegments.get(vlan)
      if (existing) return existing.id
      const segment = { id: `vlan-${vlan}`, vlan }
      vlanSegments.set(vlan, segment)
      return segment.id
    })
    // An address on a link end is the node's address in the network the link forms.
    if (link.from.ip || link.to.ip) {
      const addressed: input.Segment = {
        id: `${id}:addresses`,
        addresses: {
          ...(link.from.ip && { [link.from.node]: link.from.ip }),
          ...(link.to.ip && { [link.to.node]: link.to.ip }),
        },
      }
      linkSegments.push(addressed)
      segments.push(addressed.id)
    }
    if (link.redundancy) {
      redundancy.push({
        id: `${link.from.node}-${link.to.node}`,
        nodes: [link.from.node, link.to.node],
        kind: link.redundancy,
      })
    }

    const { presence, provenance, entityId, metadata } = link
    const linkObserved = pick({ presence, provenance, entityId, metadata })
    if (linkObserved) observed.links[id] = linkObserved
    const { label, type, style } = link
    const linkDrawn = pick({ label, type, style })
    if (linkDrawn) drawn.links[id] = linkDrawn

    const length = link.cable?.length_m
    // The ends' module standard names the speed; the rate is for links without one.
    const speed =
      getStandardSpec(link.from.plug?.module?.standard)?.speedBps ??
      getStandardSpec(link.to.plug?.module?.standard)?.speedBps ??
      link.speedBps
    const cableType = link.cable?.category ?? link.cable?.medium
    const cable: input.Link['cable'] = link.cable?.productId
      ? { ...(cableType && { type: cableType }), productId: link.cable.productId }
      : cableType
    return {
      ...((link.id || linkObserved || linkDrawn) && { id }),
      endpoints: [end(link.from), end(link.to)],
      ...(speed && { speed: rateFromBps(speed) }),
      ...(length && { length: `${length}m` as input.Length }),
      ...(cable && { cable }),
      ...(link.via?.length && { via: [...link.via] }),
      ...(segments.length > 0 && { segments }),
      ...(link.type === 'dashed' && { virtual: true as const }),
      ...(link.type === 'dotted' && { assumed: true as const }),
    }
  }
}

/** A graph as one contribution to a merge: the inverse of `sourceToGraph`. */
export function graphToSource(graph: NetworkGraph): SourceNetwork {
  const { model, observation } = fromNetworkGraph(graph)
  return {
    network: model.config,
    ...(observation && { observation }),
    ...(model.drawing && { drawing: model.drawing }),
  }
}

/** The port without its name and what the merge of sources said of it. */
function withoutObservation(
  port: NodePort,
): Omit<NodePort, 'id' | 'provenance' | 'identity' | 'attachments' | 'suppressedAttachments'> {
  const {
    id: _,
    provenance: _p,
    identity: _i,
    attachments: _a,
    suppressedAttachments: _s,
    ...rest
  } = port
  return rest
}

function nonEmpty<T>(record: Record<string, T>): Record<string, T> | undefined {
  return Object.keys(record).length > 0 ? record : undefined
}

/** Keeps the fields that are set; undefined when none is. */
function pick<T extends object>(fields: T): T | undefined {
  const set = Object.entries(fields).filter(([, v]) => v !== undefined)
  return set.length > 0 ? (Object.fromEntries(set) as T) : undefined
}

function byPort<T>(
  ports: NodePort[] | undefined,
  layer: (port: NodePort) => T | undefined,
): Record<string, T> | undefined {
  const entries = (ports ?? []).flatMap((p) => {
    const value = layer(p)
    return value && Object.keys(value).length > 0 ? [[p.id, value] as const] : []
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function nestGroups(subgraphs: readonly Subgraph[], parent?: string): input.Group[] {
  return subgraphs
    .filter((sg) => sg.parent === parent)
    .map((sg) => {
      const children = nestGroups(subgraphs, sg.id)
      return {
        id: sg.id,
        ...(sg.label && { label: sg.label }),
        ...(children.length > 0 && { groups: children }),
      }
    })
}

/** Writes a rate in bits/sec as the input does, such as `10G` or `100M`. */
export function rateFromBps(bps: number): input.Rate {
  if (bps >= 1e12 && bps % 1e10 === 0) return `${bps / 1e12}T`
  if (bps >= 1e9 && bps % 1e7 === 0) return `${bps / 1e9}G`
  return `${bps / 1e6}M`
}
