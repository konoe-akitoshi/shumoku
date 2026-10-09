// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import yaml from 'js-yaml'
import type * as input from '../input/model.js'
import type { NetworkModel } from './network-model.js'
import {
  DeviceType,
  type Link,
  type LinkEndpoint,
  type NetworkGraph,
  type Node,
  type NodePort,
  type NodeSpec,
  type Subgraph,
} from './types.js'

/** Reads the YAML people write into a model that holds it as its configuration. */
export function readNetworkModel(text: string): NetworkModel {
  const config = yaml.load(text)
  if (!isNetwork(config)) throw new Error('expected a network with nodes and links')
  return { config }
}

function isNetwork(value: unknown): value is input.Network {
  if (typeof value !== 'object' || value === null) return false
  const { nodes, links } = value as Record<string, unknown>
  return Array.isArray(nodes) && Array.isArray(links)
}

/**
 * Builds the graph that layout and the renderers draw from the configuration and its layers.
 * Sources are not read: Server merges them into the configuration first.
 */
export function toNetworkGraph(model: NetworkModel): NetworkGraph {
  const { config, observation, design, drawing } = model
  const segments = new Map(config.segments?.map((s) => [s.id, s]))
  const nodeIds = new Set(config.nodes.map((n) => n.id))
  const paired = (a: string, b: string) =>
    config.redundancy?.some((r) => r.nodes.includes(a) && r.nodes.includes(b)) ?? false

  // A segment that a node is joined to as a whole is drawn as a node of its own.
  const segmentLinks = config.links.filter((l) => l.endpoints.some((e) => !('node' in e)))
  const drawnSegments = config.segments?.filter((s) =>
    segmentLinks.some((l) => l.endpoints.some((e) => 'segment' in e && e.segment === s.id)),
  )

  return {
    version: '1',
    ...(config.name && { name: config.name }),
    ...(config.description && { description: config.description }),
    nodes: [...config.nodes.map(toNode), ...(drawnSegments ?? []).map(segmentNode)],
    links: [...config.links.flatMap(toLink), ...config.nodes.flatMap(hostLink)],
    ...(config.groups && { subgraphs: flattenGroups(config.groups).map(toSubgraph) }),
    ...(design?.terminations && { terminations: [...design.terminations] }),
    ...(drawing?.settings && { settings: drawing.settings }),
    ...(observation?.attachments && { attachments: [...observation.attachments] }),
    ...(observation?.exclusions && { exclusions: [...observation.exclusions] }),
  }

  function toNode(node: input.Node): Node {
    const { ports: seen, metadata, ...observed } = observation?.nodes?.[node.id] ?? {}
    const { ports: owned, ...designed } = design?.nodes?.[node.id] ?? {}
    const { ports: placed, icon, ...drawn } = drawing?.nodes?.[node.id] ?? {}
    const portNames = new Set([
      ...Object.keys(owned ?? {}),
      ...Object.keys(seen ?? {}),
      ...Object.keys(placed ?? {}),
    ])
    const ports = [...portNames].map(
      (name): NodePort => ({
        id: name,
        label: name,
        connectors: [],
        ...owned?.[name],
        ...placed?.[name],
        ...seen?.[name],
      }),
    )
    return {
      id: node.id,
      label: node.label ?? node.id,
      ...(node.group && { parent: node.group }),
      spec: nodeSpec(node, icon),
      ...(ports.length > 0 && { ports }),
      ...(metadata && { metadata: { ...metadata } }),
      ...observed,
      ...designed,
      ...drawn,
    }
  }

  function segmentNode(segment: input.Segment): Node {
    return {
      id: segment.id,
      label: segment.label ?? segment.id,
      ...(segment.group && { parent: segment.group }),
      spec: { kind: 'hardware', type: DeviceType.Segment },
    }
  }

  function toLink(link: input.Link): Link[] {
    const [a, b] = link.endpoints.map(toEnd)
    if (!a || !b) return []
    const { ends, cableProductId, ...designed } = (link.id && design?.links?.[link.id]) || {}
    const vlan = (link.segments ?? []).flatMap((s) => segments.get(s)?.vlan ?? [])
    const length = link.length && meters(link.length)
    return [
      {
        ...(link.id && { id: link.id }),
        from: { ...a, ...(ends?.[0]?.plug && { plug: ends[0].plug }) },
        to: { ...b, ...(ends?.[1]?.plug && { plug: ends[1].plug }) },
        ...(link.speed && { rateBps: bitsPerSecond(link.speed) }),
        ...(vlan.length > 0 && { vlan }),
        ...(paired(a.node, b.node) && { redundancy: 'ha' as const }),
        ...((link.virtual || link.assumed) && { type: 'dashed' as const }),
        ...((length || cableProductId) && {
          cable: {
            ...(length && { length_m: length }),
            ...(cableProductId && { productId: cableProductId }),
          },
        }),
        ...(link.id && observation?.links?.[link.id]),
        ...designed,
        ...(link.id && drawing?.links?.[link.id]),
      },
    ]
  }

  /** A routing domain has no node to draw, so a link to one is not drawn. */
  function toEnd(end: input.Endpoint): LinkEndpoint | undefined {
    if ('node' in end) return { node: end.node, port: end.port ?? '' }
    if ('segment' in end) return { node: end.segment, port: '' }
    return undefined
  }

  // The graph has no "runs on", so a VM on a known host is drawn with a dashed line to it.
  function hostLink(node: input.Node): Link[] {
    if (!node.host || !nodeIds.has(node.host)) return []
    return [
      { from: { node: node.host, port: '' }, to: { node: node.id, port: '' }, type: 'dashed' },
    ]
  }

  function toSubgraph({ group, parent }: { group: input.Group; parent?: string }): Subgraph {
    return {
      id: group.id,
      label: group.label ?? group.id,
      ...(parent && { parent }),
      ...observation?.groups?.[group.id],
      ...drawing?.groups?.[group.id],
    }
  }
}

function nodeSpec(node: input.Node, icon: string | undefined): NodeSpec {
  const [maker, ...rest] = node.product?.split('/') ?? []
  const model = rest.at(-1)
  return {
    kind: 'hardware',
    ...(node.type && { type: deviceType(node.type) }),
    ...(maker && maker !== '?' && { vendor: maker }),
    ...(model && { model }),
    ...(icon && { icon }),
  }
}

const deviceTypes: Record<string, DeviceType> = {
  ...Object.fromEntries(Object.values(DeviceType).map((t) => [t, t])),
  switch: DeviceType.L2Switch,
  lb: DeviceType.LoadBalancer,
  ap: DeviceType.AccessPoint,
  onu: DeviceType.CPE,
  ont: DeviceType.CPE,
  'terminal-server': DeviceType.ConsoleServer,
  db: DeviceType.Database,
}

function deviceType(type: string): DeviceType {
  return deviceTypes[type.toLowerCase()] ?? DeviceType.Generic
}

function flattenGroups(
  groups: readonly input.Group[],
  parent?: string,
): { group: input.Group; parent?: string }[] {
  return groups.flatMap((group) => [
    { group, ...(parent && { parent }) },
    ...flattenGroups(group.groups ?? [], group.id),
  ])
}

const rateUnits = { M: 1e6, G: 1e9, T: 1e12 }

function bitsPerSecond(rate: input.Rate): number {
  const unit = rate.slice(-1) as keyof typeof rateUnits
  return Number.parseFloat(rate) * rateUnits[unit]
}

const lengthUnits: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
}

function meters(length: input.Length): number | undefined {
  const match = /^(\d+(?:\.\d+)?)\s?([a-z]+)$/.exec(length)
  const factor = match?.[2] && lengthUnits[match[2]]
  return match?.[1] && factor ? Number.parseFloat(match[1]) * factor : undefined
}
