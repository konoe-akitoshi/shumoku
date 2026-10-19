// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import yaml from 'js-yaml'
import type * as input from '../input/model.js'
import type { NetworkModel, SourceNetwork } from './network-model.js'
import { getStandardSpec } from './standards.js'
import {
  type CableGrade,
  type CableMedium,
  DeviceType,
  type Link,
  type LinkCable,
  type LinkEndpoint,
  type LinkPlug,
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

/** Builds the graph of what one source discovered, as the resolver merges it. */
export function sourceToGraph(source: SourceNetwork): NetworkGraph {
  const { network, observation, design, drawing } = source
  return toNetworkGraph({
    config: network,
    ...(observation && { observation }),
    ...(design && { design }),
    ...(drawing && { drawing }),
  })
}

/**
 * Builds the graph that layout and the renderers draw from the configuration and its layers.
 * Sources are not read: Server merges them into the configuration first.
 */
export function toNetworkGraph(model: NetworkModel): NetworkGraph {
  const { config, observation, design, drawing } = model
  const segments = new Map(config.segments?.map((s) => [s.id, s]))
  const nodeIds = new Set(config.nodes.map((n) => n.id))
  // A link inside one redundancy set carries the set's kind; layout pairs its two ends.
  const pairKind = (a: string, b: string) =>
    config.redundancy?.find((r) => r.nodes.includes(a) && r.nodes.includes(b))?.kind ??
    (config.redundancy?.some((r) => r.nodes.includes(a) && r.nodes.includes(b)) ? 'ha' : undefined)

  // A segment that a node is joined to as a whole is drawn as a node of its own.
  // The port names link ends use, by node, so a node has every port its links reach.
  const endPorts = new Map<string, string[]>()
  for (const link of config.links) {
    for (const end of link.endpoints) {
      if (!('node' in end) || !end.port) continue
      endPorts.set(end.node, [...(endPorts.get(end.node) ?? []), end.port])
    }
  }
  /** A node's one address among the segments a link carries, as a link end's address. */
  const addressOn = (link: input.Link, node: string): string | undefined => {
    const found = (link.segments ?? []).flatMap((s) => {
      const held = segments.get(s)?.addresses?.[node]
      return held === undefined ? [] : typeof held === 'string' ? [held] : [...held]
    })
    return found.length === 1 ? found[0] : undefined
  }
  // The addresses a link end shows, by node, so a node's notes list only the rest.
  const shownAddresses = new Map<string, Set<string>>()
  for (const link of config.links) {
    for (const end of link.endpoints) {
      if (!('node' in end)) continue
      const ip = addressOn(link, end.node)
      if (ip) shownAddresses.set(end.node, new Set([...(shownAddresses.get(end.node) ?? []), ip]))
    }
  }
  const linked = new Set(
    config.links.flatMap((l) => {
      const [a, b] = l.endpoints
      return a && b && 'node' in a && 'node' in b
        ? [`${a.node}|${b.node}`, `${b.node}|${a.node}`]
        : []
    }),
  )
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
    const { ports: seen, metadata, fieldSources, ...observed } = observation?.nodes?.[node.id] ?? {}
    const { ports: owned, spec: catalogSpec, ...designed } = design?.nodes?.[node.id] ?? {}
    const { ports: placed, icon, ...drawn } = drawing?.nodes?.[node.id] ?? {}
    // Every port a layer describes, and every port a link end names.
    const portNames = new Set([
      ...Object.keys(owned ?? {}),
      ...Object.keys(seen ?? {}),
      ...Object.keys(placed ?? {}),
      ...(endPorts.get(node.id) ?? []),
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
    const notes = nodeNotes(node)
    const parent = node.group ?? segmentGroup(node.id)
    return {
      id: node.id,
      label: node.label ?? node.id,
      ...(parent && { parent }),
      spec: catalogSpec ? { ...catalogSpec, ...(icon && { icon }) } : nodeSpec(node, icon),
      ...(ports.length > 0 && { ports }),
      ...(notes.length > 0 && { notes }),
      ...(metadata && { metadata: { ...metadata } }),
      ...(fieldSources && { fieldSources: graphFieldSources(fieldSources) }),
      ...observed,
      ...designed,
      ...drawn,
    }
  }

  /**
   * The group a node is drawn in when it names none: the one group the segments holding its
   * addresses are in, such as the availability zone of the subnets an instance has addresses in.
   */
  function segmentGroup(node: string): string | undefined {
    const groups = new Set(
      (config.segments ?? []).flatMap((s) => (s.group && s.addresses?.[node] ? [s.group] : [])),
    )
    return groups.size === 1 ? [...groups][0] : undefined
  }

  /** What the configuration says about a node that its drawing does not otherwise show. */
  function nodeNotes(node: input.Node): string[] {
    const shown = shownAddresses.get(node.id)
    const model = node.product?.split('/').slice(1).at(-1)
    const sets = (config.redundancy ?? []).filter((r) => r.nodes.includes(node.id))
    const addresses = [
      ...(node.address && !shown?.has(node.address) ? [node.address] : []),
      ...(config.segments ?? []).flatMap((segment) =>
        list(segment.addresses?.[node.id])
          .filter((a) => !shown?.has(a))
          .map((a) => `${a} ${segment.label ?? segment.id}`),
      ),
      // An address a redundancy set holds is the set's virtual address, shown on each member.
      ...sets.flatMap((set) =>
        (config.segments ?? []).flatMap((segment) =>
          list(segment.addresses?.[set.id]).map((a) => `VIP ${a}`),
        ),
      ),
    ]
    const hostSet = config.redundancy?.find((r) => r.id === node.host)
    const notes = [
      ...(model && model !== node.label ? [model] : []),
      ...(node.asn !== undefined ? [`AS${node.asn}`] : []),
      // A set whose members have no link between them leaves nothing else drawn.
      ...sets
        .filter((set) => !set.nodes.some((m) => m !== node.id && linked.has(`${node.id}|${m}`)))
        .map((set) => {
          const others = set.nodes.filter((m) => m !== node.id).join(', ')
          return `${set.kind ?? set.label ?? set.id} with ${others}${set.assumed ? ' ?' : ''}`
        }),
      ...(node.host && !nodeIds.has(node.host)
        ? [
            `on ${hostSet ? `${hostSet.label ?? hostSet.id} (${hostSet.nodes.join(', ')})` : node.host}`,
          ]
        : []),
      ...(node.members ? [`members ${node.members.join(', ')}`] : []),
      ...config.links.flatMap((link) => {
        const [a, b] = link.endpoints
        const domain = (e: input.Endpoint | undefined) =>
          e && 'routingDomain' in e ? e.routingDomain : undefined
        const other =
          a && 'node' in a && a.node === node.id
            ? domain(b)
            : b && 'node' in b && b.node === node.id
              ? domain(a)
              : undefined
        if (!other) return []
        const label = config.routingDomains?.find((d) => d.id === other)?.label ?? other
        return [`to ${label}`]
      }),
      // Addresses come after what relates the node to others; a node can hold many.
      ...addresses,
      ...(node.description ? [clip(node.description)] : []),
      ...(node.assumed ? ['(assumed)'] : []),
    ]
    return notes.length > MAX_NOTES
      ? [...notes.slice(0, MAX_NOTES - 1), `+${notes.length - MAX_NOTES + 1} more`]
      : notes
  }

  function segmentNode(segment: input.Segment): Node {
    const domain = config.routingDomains?.find((d) => d.id === segment.routingDomain)
    // A segment that names no group is drawn in the one group all the nodes joined to it are in.
    const joined = new Set(
      segmentLinks.flatMap((l) =>
        l.endpoints.some((e) => 'segment' in e && e.segment === segment.id)
          ? l.endpoints.flatMap((e) =>
              'node' in e ? [config.nodes.find((n) => n.id === e.node)?.group] : [],
            )
          : [],
      ),
    )
    const shared = joined.size === 1 ? [...joined][0] : undefined
    const parent = segment.group ?? shared
    const notes = [
      ...(segment.vlan !== undefined ? [`VLAN ${segment.vlan}`] : []),
      ...list(segment.prefix),
      ...(segment.routingDomain ? [`in ${domain?.label ?? segment.routingDomain}`] : []),
    ]
    return {
      id: segment.id,
      label: segment.label ?? segment.id,
      ...(parent && { parent }),
      spec: { kind: 'hardware', type: DeviceType.Segment },
      ...(notes.length > 0 && { notes }),
    }
  }

  /** What the configuration says about a link that its line does not otherwise show. */
  function linkNotes(link: input.Link): string[] {
    const unnumbered = (link.segments ?? []).flatMap((id) => {
      const segment = segments.get(id)
      if (!segment || segment.vlan !== undefined) return []
      // A segment drawn as a node shows its prefixes there.
      const drawn = drawnSegments?.some((d) => d.id === id)
      return [[segment.label ?? id, ...(drawn ? [] : list(segment.prefix))].join(' ')]
    })
    const connection = config.connections?.find((c) => c.id === link.connection)
    const cable = [link.cable, link.length].filter(Boolean).join(' ')
    return [
      ...(link.description ? [clip(link.description)] : []),
      ...unnumbered,
      ...(link.bandwidth ? [`bandwidth ${link.bandwidth}`] : []),
      ...(link.connection ? [connection?.label ?? link.connection] : []),
      ...(cable ? [cable] : []),
    ]
  }

  function toLink(link: input.Link): Link[] {
    const [a, b] = link.endpoints.map((e) => toEnd(e, link))
    if (!a || !b) return []
    const { ends, cable, ...designed } = (link.id && design?.links?.[link.id]) || {}
    const kind = pairKind(a.node, b.node)
    const vlan = (link.segments ?? []).flatMap((s) => segments.get(s)?.vlan ?? [])
    const length = link.length && meters(link.length)
    const notes = linkNotes(link)
    return [
      {
        ...(link.id && { id: link.id }),
        from: { ...a, ...(ends?.[0]?.plug && { plug: ends[0].plug }) },
        to: { ...b, ...(ends?.[1]?.plug && { plug: ends[1].plug }) },
        // The ends' module standards already name the speed; the rate is for links without one.
        ...(link.speed && !standardSpeed(ends) && { rateBps: bitsPerSecond(link.speed) }),
        ...(vlan.length > 0 && { vlan }),
        ...(kind && { redundancy: kind as Link['redundancy'] }),
        // A virtual link is dashed; one that is assumed rather than confirmed is dotted.
        ...(link.virtual
          ? { type: 'dashed' as const }
          : link.assumed && { type: 'dotted' as const }),
        ...(notes.length > 0 && { notes }),
        ...((length || cable || link.cable) && {
          cable: { ...(cable ?? cableOf(link.cable)), ...(length && { length_m: length }) },
        }),
        ...(link.id && observation?.links?.[link.id]),
        ...designed,
        ...(link.id && drawing?.links?.[link.id]),
      },
    ]
  }

  /** A routing domain has no node to draw, so a link to one is not drawn. */
  function toEnd(end: input.Endpoint, link: input.Link): LinkEndpoint | undefined {
    if ('node' in end) {
      const ip = addressOn(link, end.node)
      return { node: end.node, port: end.port ?? '', ...(ip && { ip }) }
    }
    if ('segment' in end) return { node: end.segment, port: '' }
    return undefined
  }

  // A VM on a known host is drawn with a sparse dotted line from the host.
  function hostLink(node: input.Node): Link[] {
    if (!node.host || !nodeIds.has(node.host)) return []
    return [
      { from: { node: node.host, port: '' }, to: { node: node.id, port: '' }, type: 'runs-on' },
    ]
  }

  function toSubgraph({ group, parent }: { group: input.Group; parent?: string }): Subgraph {
    const children = (group.groups ?? []).map((g) => g.id)
    return {
      id: group.id,
      label: group.label ?? group.id,
      ...(parent && { parent }),
      ...(children.length > 0 && { children }),
      ...observation?.groups?.[group.id],
      ...drawing?.groups?.[group.id],
    }
  }
}

/** The graph names a node's type and product together as its spec, and its group as parent. */
function graphFieldSources(fieldSources: Readonly<Record<string, string>>): Record<string, string> {
  const { type, product, group, ...rest } = fieldSources
  const spec = product ?? type
  return { ...rest, ...(spec && { spec }), ...(group && { parent: group }) }
}

const CABLE_GRADES: Record<string, CableMedium> = {
  cat5e: 'twisted-pair',
  cat6: 'twisted-pair',
  cat6a: 'twisted-pair',
  cat7: 'twisted-pair',
  cat8: 'twisted-pair',
  om3: 'fiber-mm',
  om4: 'fiber-mm',
  om5: 'fiber-mm',
  os1: 'fiber-sm',
  os2: 'fiber-sm',
  dac: 'dac',
  aoc: 'aoc',
}
const CABLE_MEDIA: Record<string, CableMedium> = {
  'twisted-pair': 'twisted-pair',
  'fiber-mm': 'fiber-mm',
  mmf: 'fiber-mm',
  'fiber-sm': 'fiber-sm',
  smf: 'fiber-sm',
  dac: 'dac',
  aoc: 'aoc',
}

/** The cable a configuration names, as a grade and its medium where the name is one. */
function cableOf(cable: string | undefined): LinkCable {
  const key = cable?.toLowerCase() ?? ''
  const grade = Object.hasOwn(CABLE_GRADES, key) ? (key as CableGrade) : undefined
  const medium = grade ? CABLE_GRADES[key] : CABLE_MEDIA[key]
  return { ...(medium && { medium }), ...(grade && { category: grade }) }
}

/** The speed both ends' module standards agree on, if they name one. */
function standardSpeed(
  ends: readonly [{ plug?: LinkPlug }, { plug?: LinkPlug }] | undefined,
): number | undefined {
  const speeds = (ends ?? []).flatMap(
    (e) => getStandardSpec(e.plug?.module?.standard)?.speedBps ?? [],
  )
  return speeds.length > 0 ? Math.min(...speeds) : undefined
}

const MAX_NOTES = 6

/** A note keeps to one short line. */
function clip(text: string): string {
  const line = text.split('\n')[0]?.trim() ?? ''
  return line.length > 40 ? `${line.slice(0, 39)}…` : line
}

function list(value: input.OneOrMore<string> | undefined): readonly string[] {
  return value === undefined ? [] : typeof value === 'string' ? [value] : value
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
