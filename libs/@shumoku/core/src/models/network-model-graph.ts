// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import yaml from 'js-yaml'
import { checkNetwork, NetworkInputError } from '../input/check.js'
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

/**
 * Reads the YAML people write into a model that holds it as its configuration. A network that
 * cannot be read as written throws a `NetworkInputError` listing every issue in it.
 */
export function readNetworkModel(text: string): NetworkModel {
  let value: unknown
  try {
    value = yaml.load(text)
  } catch (e) {
    const mark = (e as { mark?: { line: number; column: number } }).mark
    const where = mark ? `line ${mark.line + 1}, column ${mark.column + 1}` : 'yaml'
    throw new NetworkInputError([
      { path: where, message: (e as { reason?: string }).reason ?? String(e) },
    ])
  }
  const issues = checkNetwork(value)
  if (issues.length > 0) throw new NetworkInputError(issues)
  return { config: withPortNames(value as input.Network) }
}

/** A port YAML read as a number, such as `port: 1`, is named by that number. */
function withPortNames(config: input.Network): input.Network {
  if (!config.links.some((l) => l.endpoints.some((e) => 'node' in e && typeof e.port === 'number')))
    return config
  return {
    ...config,
    links: config.links.map((l) => ({
      ...l,
      endpoints: l.endpoints.map((e) =>
        'node' in e && typeof e.port === 'number' ? { ...e, port: String(e.port) } : e,
      ) as unknown as input.Link['endpoints'],
    })),
  }
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
    return {
      id: node.id,
      label: node.label ?? node.id,
      ...(node.group && { parent: node.group }),
      spec: catalogSpec ? { ...catalogSpec, ...(icon && { icon }) } : nodeSpec(node, icon),
      ...(ports.length > 0 && { ports }),
      ...(metadata && { metadata: { ...metadata } }),
      ...(fieldSources && { fieldSources: graphFieldSources(fieldSources) }),
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
    const [a, b] = link.endpoints.map((e) => toEnd(e, link))
    if (!a || !b) return []
    const { ends, cable, ...designed } = (link.id && design?.links?.[link.id]) || {}
    const kind = pairKind(a.node, b.node)
    const vlan = (link.segments ?? []).flatMap((s) => segments.get(s)?.vlan ?? [])
    const length = link.length && meters(link.length)
    return [
      {
        ...(link.id && { id: link.id }),
        from: { ...a, ...(ends?.[0]?.plug && { plug: ends[0].plug }) },
        to: { ...b, ...(ends?.[1]?.plug && { plug: ends[1].plug }) },
        // The ends' module standards already name the speed; the rate is for links without one.
        ...(link.speed && !standardSpeed(ends) && { rateBps: bitsPerSecond(link.speed) }),
        ...(vlan.length > 0 && { vlan }),
        ...(kind && { redundancy: kind as Link['redundancy'] }),
        ...((link.virtual || link.assumed) && { type: 'dashed' as const }),
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

  // The graph has no "runs on", so a VM on a known host is drawn with a dashed line to it.
  function hostLink(node: input.Node): Link[] {
    if (!node.host || !nodeIds.has(node.host)) return []
    return [
      { from: { node: node.host, port: '' }, to: { node: node.id, port: '' }, type: 'dashed' },
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
