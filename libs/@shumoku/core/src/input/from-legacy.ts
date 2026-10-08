import type { z } from 'zod'
import { STANDARD_SPECS } from '../models/standards.js'
import type {
  YamlLink,
  YamlLinkEndpoint,
  YamlNetworkInput,
  YamlNode,
  YamlSubgraph,
} from '../parser/parser.js'
import { type Network, Rate } from './schema.js'

type Written<T extends z.ZodType> = z.input<T>
type WrittenNetwork = Written<typeof Network>
type WrittenGroup = NonNullable<WrittenNetwork['groups']>[number]
type WrittenNode = WrittenNetwork['nodes'][number]
type WrittenLink = WrittenNetwork['links'][number]
type WrittenSegment = NonNullable<WrittenNetwork['segments']>[number]

/** The input written from an older document, and what the older document said that it leaves out. */
export interface ConvertedInput {
  network: WrittenNetwork
  /** The older fields that were not carried over, such as `nodes[].style`, each named once. */
  dropped: string[]
}

/**
 * Writes an older document in the input's shape. Only facts carry over; how the older document
 * was drawn (styles, shapes, settings, labels on lines) does not. The result is not checked:
 * read it with `readNetworkInput`, which reports anything the older document left inconsistent.
 */
export function fromLegacyInput(legacy: YamlNetworkInput): ConvertedInput {
  const dropped = new Set<string>()
  const drop = (field: string) => dropped.add(field)
  const segments = new Map<number, WrittenSegment>()
  const redundancy = new Map<string, string[]>()
  const nodes = new Map<string, WrittenNode>()

  for (const [field, value] of Object.entries(legacy)) {
    if (!['name', 'description', 'nodes', 'links', 'subgraphs'].includes(field) && value)
      drop(field)
  }
  for (const node of legacy.nodes ?? []) {
    if (!node.id) drop('nodes[] without id')
    else if (nodes.has(node.id)) drop('nodes[] with a repeated id')
    else nodes.set(node.id, convertNode(node, node.id, drop))
  }
  const links = (legacy.links ?? []).flatMap((link) => {
    const converted = convertLink(link)
    return converted ? [converted] : []
  })

  const groups = legacy.subgraphs && nestGroups(legacy.subgraphs, drop)
  const network: WrittenNetwork = {
    ...(legacy.name && { name: legacy.name }),
    ...(legacy.description && { description: legacy.description }),
    ...(groups && groups.length > 0 && { groups }),
    ...(segments.size > 0 && { segments: [...segments.values()] }),
    ...(redundancy.size > 0 && {
      redundancy: [...redundancy].map(([id, members]) => ({ id, nodes: members })),
    }),
    nodes: [...nodes.values()],
    links,
  }
  return { network, dropped: [...dropped] }

  function convertLink(link: YamlLink): WrittenLink | undefined {
    const ends = [link.from, link.to].map(endOf)
    const [a, b] = ends
    if (!a || !b) {
      drop('links[] to a pin')
      return undefined
    }
    for (const field of ['id', 'label', 'type', 'arrow', 'style'] as const) {
      if (link[field] !== undefined) drop(`links[].${field}`)
    }
    const vlans = link.vlan === undefined ? [] : [link.vlan].flat()
    for (const vlan of vlans)
      if (!segments.has(vlan)) segments.set(vlan, { id: `vlan-${vlan}`, vlan })
    // An older end's ip is its address in the one VLAN the line carries; with no VLAN, or several,
    // which segment it is in is not known.
    for (const [i, end] of [link.from, link.to].entries()) {
      const ip = typeof end === 'string' ? undefined : end.ip
      const node = ends[i]?.node
      if (!ip || !node) continue
      const [only, ...more] = vlans
      const segment = only === undefined ? undefined : segments.get(only)
      const holder = nodes.get(node)
      if (only !== undefined && segment && more.length === 0) {
        const known = [segment.addresses?.[node] ?? []].flat()
        const all = [...new Set([...known, ip])]
        const written = all.length === 1 ? ip : (all as [string, ...string[]])
        segments.set(only, { ...segment, addresses: { ...segment.addresses, [node]: written } })
      } else if (holder && !holder.address) nodes.set(node, { ...holder, address: ip })
      else drop('links[].from.ip and links[].to.ip')
    }
    if (link.redundancy) pair(a.node, b.node)
    // Older documents also wrote the rate itself as bandwidth, which the older parser never read.
    const written = (link as { bandwidth?: unknown }).bandwidth
    const speed =
      rateOf(link.standard ?? moduleStandard(link.from) ?? moduleStandard(link.to)) ??
      (Rate.safeParse(written).success ? (written as WrittenLink['speed']) : undefined)
    if ((link.standard || moduleStandard(link.from)) && !speed) drop('links[].standard')
    const cable = link.cable?.category ?? link.cable?.cable_category ?? link.cable?.medium
    const length = link.cable?.length_m
    return {
      endpoints: [a, b],
      ...(speed && { speed }),
      ...(cable && { cable }),
      ...(length && { length: `${length}m` }),
      ...(vlans.length > 0 && { segments: vlans.map((vlan) => `vlan-${vlan}`) }),
    }
  }

  // An older HA line joins two nodes that stand in for one another; lines among the same nodes
  // make one set.
  function pair(a: string, b: string) {
    const holding = [...redundancy].filter(
      ([, members]) => members.includes(a) || members.includes(b),
    )
    const members = [...new Set([a, b, ...holding.flatMap(([, m]) => m)])]
    for (const [id] of holding) redundancy.delete(id)
    redundancy.set(`ha-${members.join('-')}`, members)
  }
}

function endOf(end: string | YamlLinkEndpoint): { node: string; port?: string } | undefined {
  if (typeof end === 'string') return { node: end }
  if (end.pin) return undefined
  return { node: end.node, ...(end.port && { port: end.port }) }
}

function moduleStandard(end: string | YamlLinkEndpoint): string | undefined {
  return typeof end === 'string' ? undefined : end.module?.standard
}

/** An older standard carries its rate; one that is not known carries none. */
function rateOf(standard: string | undefined): WrittenLink['speed'] {
  const bps = standard && STANDARD_SPECS[standard]?.speedBps
  if (!bps) return undefined
  const [value, unit] =
    bps >= 1e12 ? [bps / 1e12, 'T'] : bps >= 1e9 ? [bps / 1e9, 'G'] : [bps / 1e6, 'M']
  return `${value}${unit}` as WrittenLink['speed']
}

function convertNode(node: YamlNode, id: string, drop: (field: string) => void): WrittenNode {
  for (const field of [
    'shape',
    'rank',
    'style',
    'metadata',
    'icon',
    'identity',
    'ports',
  ] as const) {
    if (node[field] !== undefined) drop(`nodes[].${field}`)
  }
  if (node.resource) drop('nodes[].resource')
  // An older label of several lines is the name and then facts about the node.
  const [name, ...facts] = [node.label ?? []]
    .flat()
    .map((line) => line.replace(/<[^>]*>/g, '').trim())
  const product = [node.vendor ?? '?', node.service, node.model].filter((step) => step)
  return {
    id,
    ...(name && name !== id && { label: name }),
    ...(node.type && { type: node.type }),
    ...(product.length > 1 && { product: product.join('/') }),
    ...(product.length === 1 && node.vendor && { product: node.vendor }),
    ...(facts.length > 0 && { description: facts.join(', ') }),
    ...(node.parent && { group: node.parent }),
  }
}

/** Older regions name their parent; the input writes each inside the one it is in. */
function nestGroups(regions: YamlSubgraph[], drop: (field: string) => void): WrittenGroup[] {
  for (const field of [
    'style',
    'direction',
    'file',
    'pins',
    'membership',
    'identity',
    'scope',
  ] as const) {
    if (regions.some((r) => r[field] !== undefined)) drop(`subgraphs[].${field}`)
  }
  const withId = regions.filter((r): r is YamlSubgraph & { id: string } => Boolean(r.id))
  if (withId.length < regions.length) drop('subgraphs[] without id')
  const ids = new Set(withId.map((r) => r.id))
  const parentOf = new Map<string, string>()
  for (const r of withId) {
    if (r.parent && ids.has(r.parent)) parentOf.set(r.id, r.parent)
    for (const child of r.children ?? []) if (ids.has(child)) parentOf.set(child, r.id)
  }
  // A region that leads back to itself through its parents is written at the top.
  const inCycle = (id: string) => {
    const seen = new Set<string>()
    let at = parentOf.get(id)
    while (at) {
      if (at === id || seen.has(at)) return true
      seen.add(at)
      at = parentOf.get(at)
    }
    return false
  }
  const build = (parent: string | undefined): WrittenGroup[] =>
    withId
      .filter((r) => (inCycle(r.id) ? undefined : parentOf.get(r.id)) === parent)
      .map((r) => {
        const inner = build(r.id)
        return {
          id: r.id,
          ...(r.label && { label: r.label }),
          ...(inner.length > 0 && { groups: inner }),
        }
      })
  return build(undefined)
}
