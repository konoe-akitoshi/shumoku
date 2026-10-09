// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import yaml from 'js-yaml'
import type * as input from '../input/model.js'
import type { DesignLayer, DrawingLayer, NetworkModel, ObservationLayer } from './network-model.js'
import { getStandardSpec } from './standards.js'
import {
  DeviceType,
  type Link,
  type NetworkGraph,
  type Node,
  type NodePort,
  type Subgraph,
} from './types.js'

/** Writes a model's configuration as the YAML people write. Its layers are not written. */
export function writeNetworkModel(model: NetworkModel): string {
  return yaml.dump(model.config, { lineWidth: 100, noRefs: true })
}

type Entry<T> = NonNullable<T>[string & keyof NonNullable<T>]

/**
 * Splits a drawn graph back into its configuration and layers: the inverse of `toNetworkGraph`
 * for what the configuration can say. A node drawn for a segment becomes the segment again.
 */
export function fromNetworkGraph(graph: NetworkGraph): NetworkModel {
  const isSegment = (n: Node) => n.spec?.kind !== 'service' && n.spec?.type === DeviceType.Segment
  const segmentIds = new Set(graph.nodes.filter(isSegment).map((n) => n.id))
  const vlanSegments = new Map<number, input.Segment>()
  const redundancy: input.Redundancy[] = []
  const observed = {
    nodes: {} as Record<string, Entry<ObservationLayer['nodes']>>,
    links: {} as Record<string, Entry<ObservationLayer['links']>>,
    groups: {} as Record<string, Entry<ObservationLayer['groups']>>,
  }
  const designed = {
    nodes: {} as Record<string, Entry<DesignLayer['nodes']>>,
    links: {} as Record<string, Entry<DesignLayer['links']>>,
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
  ]
  const groups = nestGroups(graph.subgraphs ?? [])
  for (const sg of graph.subgraphs ?? []) {
    const { identity, membership, scope, provenance, attachments } = sg
    const observation = pick({ identity, membership, scope, provenance, attachments })
    if (observation) observed.groups[sg.id] = observation
    const { direction, style, bounds, spec } = sg
    const drawing = pick({ direction, style, bounds, spec })
    if (drawing) drawn.groups[sg.id] = drawing
  }

  const observation = pick({
    nodes: nonEmpty(observed.nodes),
    links: nonEmpty(observed.links),
    groups: nonEmpty(observed.groups),
    attachments: graph.attachments,
    exclusions: graph.exclusions,
  })
  const design = pick({
    nodes: nonEmpty(designed.nodes),
    links: nonEmpty(designed.links),
    terminations: graph.terminations,
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
  }
  return {
    config,
    ...(observation && { observation }),
    ...(design && { design }),
    ...(drawing && { drawing }),
  }

  function toConfigNode(node: Node): input.Node {
    const spec = node.spec?.kind === 'service' ? undefined : node.spec
    const vendor = node.spec?.vendor
    const model = spec?.kind === 'hardware' ? spec.model : undefined
    const product = model ? `${vendor ?? '?'}/${model}` : vendor
    const label = Array.isArray(node.label) ? node.label[0] : node.label

    const { presence, provenance, identity, attachments, fieldSources } = node
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
      fieldSources,
      suppressedAttachments,
      entityId,
      metadata,
      ports: portObservation,
    })
    if (nodeObserved) observed.nodes[node.id] = nodeObserved

    const { productId, termination } = node
    const portDesign = byPort(node.ports, (p) => {
      const { id: _, placement: __, ...rest } = p
      const { provenance, identity, attachments, suppressedAttachments, entityId, ...owned } = rest
      // A port made only from a link end's name says nothing the link does not.
      const { label, connectors, source, ...more } = owned
      const bare = label === p.id && connectors.length === 0 && Object.keys(more).length === 0
      return bare ? undefined : owned
    })
    const nodeDesigned = pick({ productId, termination, ports: portDesign })
    if (nodeDesigned) designed.nodes[node.id] = nodeDesigned

    const { shape, style, position, size } = node
    const portDrawing = byPort(node.ports, (p) => pick({ placement: p.placement }))
    const nodeDrawn = pick({ shape, style, position, size, icon: spec?.icon, ports: portDrawing })
    if (nodeDrawn) drawn.nodes[node.id] = nodeDrawn

    return {
      id: node.id,
      ...(label && label !== node.id && { label }),
      ...(spec?.type && { type: spec.type }),
      ...(product && { product }),
      ...(node.parent && { group: node.parent }),
    }
  }

  function toConfigLink(link: Link, index: number): input.Link {
    const id = link.id ?? `link-${index}`
    const end = (e: Link['from']): input.Endpoint =>
      segmentIds.has(e.node)
        ? { segment: e.node }
        : { node: e.node, ...(e.port && { port: e.port }) }
    const segments = (link.vlan ?? []).map((vlan) => {
      const existing = vlanSegments.get(vlan)
      if (existing) return existing.id
      const segment = { id: `vlan-${vlan}`, vlan }
      vlanSegments.set(vlan, segment)
      return segment.id
    })
    if (link.redundancy) {
      redundancy.push({
        id: `${link.from.node}-${link.to.node}`,
        nodes: [link.from.node, link.to.node],
      })
    }

    const { presence, provenance, entityId } = link
    const linkObserved = pick({ presence, provenance, entityId })
    if (linkObserved) observed.links[id] = linkObserved
    const plugs = [link.from.plug, link.to.plug]
    const ends = plugs.some(Boolean)
      ? ([
          { ...(plugs[0] && { plug: plugs[0] }) },
          { ...(plugs[1] && { plug: plugs[1] }) },
        ] as const)
      : undefined
    const { via, bends } = link
    const linkDesigned = pick({ via, bends, ends, cableProductId: link.cable?.productId })
    if (linkDesigned) designed.links[id] = linkDesigned
    const { label, type, arrow, style } = link
    const linkDrawn = pick({ label, type, arrow, style })
    if (linkDrawn) drawn.links[id] = linkDrawn

    const length = link.cable?.length_m
    // The ends' module standard names the speed; the rate is for links without one.
    const speed =
      getStandardSpec(link.from.plug?.module?.standard)?.speedBps ??
      getStandardSpec(link.to.plug?.module?.standard)?.speedBps ??
      link.rateBps
    return {
      ...((link.id || linkObserved || linkDesigned || linkDrawn) && { id }),
      endpoints: [end(link.from), end(link.to)],
      ...(speed && { speed: rate(speed) }),
      ...(length && { length: `${length}m` as input.Length }),
      ...(segments.length > 0 && { segments }),
      ...(link.type === 'dashed' && { virtual: true as const }),
    }
  }
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
        ...(sg.label && sg.label !== sg.id && { label: sg.label }),
        ...(children.length > 0 && { groups: children }),
      }
    })
}

function rate(bps: number): input.Rate {
  if (bps >= 1e12 && bps % 1e10 === 0) return `${bps / 1e12}T`
  if (bps >= 1e9 && bps % 1e7 === 0) return `${bps / 1e9}G`
  return `${bps / 1e6}M`
}
