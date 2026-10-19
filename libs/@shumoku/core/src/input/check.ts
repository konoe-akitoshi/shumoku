// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from './model.js'

/** One thing wrong with a written network: where it is, and what to write instead. */
export interface NetworkIssue {
  /** Where it is, such as `nodes[3].lable`. */
  readonly path: string
  readonly message: string
}

/** A network that cannot be read as written, with every issue found in it. */
export class NetworkInputError extends Error {
  readonly issues: readonly NetworkIssue[]
  constructor(issues: readonly NetworkIssue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join('\n'))
    this.name = 'NetworkInputError'
    this.issues = issues
  }
}

// The fields each place takes. A record over every key of the type makes the compiler fail here
// when model.ts gains or loses a field, so the check and the types cannot drift apart.
const fields = <T>(keys: Record<keyof T, true>): readonly string[] => Object.keys(keys)
const NETWORK = fields<input.Network>({
  name: true,
  description: true,
  groups: true,
  routingDomains: true,
  connections: true,
  segments: true,
  redundancy: true,
  nodes: true,
  links: true,
})
const GROUP = fields<input.Group>({ id: true, label: true, groups: true })
const ROUTING_DOMAIN = fields<input.RoutingDomain>({ id: true, label: true, prefix: true })
const CONNECTION = fields<input.Connection>({ id: true, label: true })
const SEGMENT = fields<input.Segment>({
  id: true,
  label: true,
  vlan: true,
  prefix: true,
  routingDomain: true,
  group: true,
  addresses: true,
})
const NODE = fields<input.Node>({
  id: true,
  label: true,
  type: true,
  product: true,
  software: true,
  address: true,
  asn: true,
  description: true,
  group: true,
  assumed: true,
  host: true,
  members: true,
})
const REDUNDANCY = fields<input.Redundancy>({
  id: true,
  label: true,
  nodes: true,
  kind: true,
  assumed: true,
})
const LINK = fields<input.Link>({
  id: true,
  endpoints: true,
  speed: true,
  bandwidth: true,
  cable: true,
  length: true,
  segments: true,
  description: true,
  connection: true,
  assumed: true,
  virtual: true,
})
const NODE_END = fields<input.NodeEnd>({ node: true, port: true })

/** Written fields by name; any of the input's field names may be read, and any may be absent. */
type FieldName =
  | keyof input.Network
  | keyof input.Group
  | keyof input.RoutingDomain
  | keyof input.Segment
  | keyof input.Node
  | keyof input.Redundancy
  | keyof input.Link
  | keyof input.NodeEnd
  | keyof input.SegmentEnd
  | keyof input.RoutingDomainEnd
type Fields = { readonly [K in FieldName]?: unknown }

/**
 * Every issue in a written network, all at once: someone who writes from an example needs the
 * whole list, not the first mistake. An empty list means the network can be read.
 */
export function checkNetwork(value: unknown): NetworkIssue[] {
  const issues: NetworkIssue[] = []
  const issue = (path: string, message: string) => issues.push({ path, message })

  const root = record(value, 'network')
  if (!root) return issues
  only(root, NETWORK, '')
  const at = (base: string, key: string) => (base ? `${base}.${key}` : key)

  const groups: { id: string; path: string }[] = []
  const walkGroups = (list: unknown, path: string) => {
    for (const [i, g] of items(list, path)) {
      const p = `${path}[${i}]`
      const group = record(g, p)
      if (!group) continue
      only(group, GROUP, p)
      const id = string(group.id, `${p}.id`)
      if (id) groups.push({ id, path: p })
      optionalString(group.label, `${p}.label`)
      if (group.groups !== undefined) walkGroups(group.groups, `${p}.groups`)
    }
  }
  if (root.groups !== undefined) walkGroups(root.groups, 'groups')

  const domains = entries(root.routingDomains, 'routingDomains', ROUTING_DOMAIN, (d, p) => {
    optionalString(d.label, `${p}.label`)
    optionalStrings(d.prefix, `${p}.prefix`)
    // "Routing domain" also names an AS in routing, and writers reach for it to hold one.
    const names = [d.id, d.label].filter((n): n is string => typeof n === 'string')
    if (names.some((n) => /^as[\s_-]?\d+$/i.test(n)))
      issue(p, 'an AS is not a routing domain; write its number as asn on its nodes')
  })
  const connections = entries(root.connections, 'connections', CONNECTION, (c, p) =>
    optionalString(c.label, `${p}.label`),
  )
  const segments = entries(root.segments, 'segments', SEGMENT, (s, p) => {
    optionalString(s.label, `${p}.label`)
    optionalInteger(s.vlan, `${p}.vlan`, 1, 4094)
    optionalStrings(s.prefix, `${p}.prefix`)
    optionalString(s.routingDomain, `${p}.routingDomain`)
    optionalString(s.group, `${p}.group`)
    if (s.addresses !== undefined) {
      const addresses = record(s.addresses, `${p}.addresses`)
      for (const [holder, a] of Object.entries(addresses ?? {}))
        optionalStrings(a, `${p}.addresses.${holder}`)
    }
  })
  const redundancy = entries(root.redundancy, 'redundancy', REDUNDANCY, (r, p) => {
    optionalString(r.label, `${p}.label`)
    optionalString(r.kind, `${p}.kind`)
    optionalTrue(r.assumed, `${p}.assumed`)
    const nodes = [...items(r.nodes, `${p}.nodes`)].map(([i, n]) => string(n, `${p}.nodes[${i}]`))
    if (new Set(nodes).size !== nodes.length) issue(`${p}.nodes`, 'a node is listed twice')
    if (Array.isArray(r.nodes) && nodes.length < 2) issue(`${p}.nodes`, 'expected at least 2 nodes')
  })
  if (root.nodes === undefined) issue('nodes', 'missing; list the network’s nodes')
  const nodes = entries(root.nodes ?? [], 'nodes', NODE, (n, p) => {
    for (const key of [
      'label',
      'type',
      'software',
      'address',
      'description',
      'group',
      'host',
    ] as const)
      optionalString(n[key], `${p}.${key}`)
    optionalInteger(n.asn, `${p}.asn`, 1, 4294967295)
    optionalTrue(n.assumed, `${p}.assumed`)
    const product = optionalString(n.product, `${p}.product`)
    const steps = product?.split('/') ?? []
    if (steps.some((step) => step === '')) issue(`${p}.product`, `empty step in ${product}`)
    if (steps.slice(1).includes('?') || (steps[0] === '?' && steps.length < 2))
      issue(`${p}.product`, 'only the maker may be ?, and a model must follow it')
    if (n.members !== undefined) {
      const members = [...items(n.members, `${p}.members`)].map(([i, m]) =>
        string(m, `${p}.members[${i}]`),
      )
      if (new Set(members).size !== members.length)
        issue(`${p}.members`, 'a member is listed twice')
      if (members.length < 2) issue(`${p}.members`, 'expected at least 2')
    }
  })
  if (root.links === undefined) issue('links', 'missing; write links: [] when none is known')
  const links = entries(root.links ?? [], 'links', LINK, (l, p) => {
    optionalString(l.id, `${p}.id`)
    for (const key of ['description', 'connection', 'cable'] as const)
      optionalString(l[key], `${p}.${key}`)
    optionalTrue(l.assumed, `${p}.assumed`)
    optionalTrue(l.virtual, `${p}.virtual`)
    const speed = optionalRate(l.speed, `${p}.speed`)
    const bandwidth = optionalRate(l.bandwidth, `${p}.bandwidth`)
    if (speed && bandwidth && bitsPerSecond(bandwidth) >= bitsPerSecond(speed))
      issue(`${p}.bandwidth`, 'not below the speed; leave it out')
    const length = optionalString(l.length, `${p}.length`)
    if (length && !/^\d+(\.\d+)?\s?(mm|cm|m|km|in|ft)$/.test(length))
      issue(`${p}.length`, 'expected a number and a unit, such as 3m')
    if ((l.cable !== undefined || length) && l.virtual === true)
      issue(p, 'a virtual link has no cable')
    if (!Array.isArray(l.endpoints)) {
      issue(`${p}.endpoints`, 'expected the link’s two ends, such as [{ node: a }, { node: b }]')
    } else if (l.endpoints.length !== 2) {
      issue(
        `${p}.endpoints`,
        'a link has exactly 2 ends; write one link for each pair, or a segment for a shared network',
      )
    } else {
      for (const [i, e] of l.endpoints.entries()) endpoint(e, `${p}.endpoints[${i}]`)
    }
    if (l.segments !== undefined) {
      for (const [i, s] of items(l.segments, `${p}.segments`)) string(s, `${p}.segments[${i}]`)
      const ends = Array.isArray(l.endpoints) ? (l.endpoints as unknown[]) : []
      if (!ends.every((e) => typeof e === 'object' && e !== null && 'node' in e))
        issue(`${p}.segments`, 'only a link between two nodes carries segments')
    }
  })

  // References: every id a field names has to be written somewhere.
  const groupIds = unique(groups, 'group')
  const domainIds = unique(domains, 'routing domain')
  const connectionIds = unique(connections, 'connection')
  const segmentIds = unique(segments, 'segment')
  const nodeIds = unique(nodes, 'node')
  unique(
    links.filter((l) => l.id !== ''),
    'link',
  )
  const setIds = new Set(redundancy.map((r) => r.id))
  // Segment addresses and hosts name a node or a redundancy set, so the two share their ids.
  for (const set of redundancy) {
    if (nodeIds.has(set.id)) issue(set.path, `${set.id} is also a node id; give the set its own`)
  }
  unique(redundancy, 'redundancy')
  const holders = new Set([...nodeIds, ...setIds])

  for (const s of segments) {
    if (typeof s.fields.routingDomain === 'string' && !domainIds.has(s.fields.routingDomain))
      issue(`${s.path}.routingDomain`, `unknown routing domain ${s.fields.routingDomain}`)
    for (const holder of Object.keys(addressMap(s.fields.addresses) ?? {})) {
      if (!holders.has(holder))
        issue(`${s.path}.addresses.${holder}`, `unknown node or redundancy set ${holder}`)
    }
  }
  for (const item of [...nodes, ...segments]) {
    const group = item.fields.group
    if (typeof group === 'string' && !groupIds.has(group))
      issue(`${item.path}.group`, `unknown group ${group}; list it under groups`)
  }
  for (const set of redundancy) {
    for (const [i, node] of items(set.fields.nodes, '', true)) {
      if (typeof node === 'string' && !nodeIds.has(node))
        issue(`${set.path}.nodes[${i}]`, `unknown node ${node}`)
    }
  }
  for (const node of nodes) {
    const { host, address } = node.fields
    if (typeof host === 'string' && !holders.has(host))
      issue(`${node.path}.host`, `unknown host ${host}; name a node or a redundancy set`)
    if (
      typeof address === 'string' &&
      segments.some((s) => addressList(addressMap(s.fields.addresses)?.[node.id]).includes(address))
    )
      issue(`${node.path}.address`, `${address} is in a segment; drop node.address`)
  }
  // Hosts may chain (nested virtualization), but no choice of host may lead back to the start.
  // A set may run its guest on any of its nodes, so it leads to each of them.
  const runsOn = (id: string): string[] => {
    const set = redundancy.find((r) => r.id === id)
    if (set) return (Array.isArray(set.fields.nodes) ? set.fields.nodes : []).filter(isString)
    const host = nodes.find((n) => n.id === id)?.fields.host
    return typeof host === 'string' ? [host] : []
  }
  const settled = new Set<string>()
  const cycles = new Set<string>()
  const visit = (id: string, path: string[]) => {
    if (path.includes(id)) {
      cycles.add(path[0] ?? id)
      return
    }
    if (settled.has(id)) return
    for (const next of runsOn(id)) visit(next, [...path, id])
    settled.add(id)
  }
  for (const node of nodes) visit(node.id, [])
  for (const node of nodes) if (cycles.has(node.id)) issue(`${node.path}.host`, 'host cycle')

  for (const link of links) {
    const ends = Array.isArray(link.fields.endpoints) ? link.fields.endpoints : []
    for (const [i, e] of ends.entries()) {
      const end = record(e, '', true)
      if (!end) continue
      const p = `${link.path}.endpoints[${i}]`
      if (typeof end.segment === 'string') {
        if (!segmentIds.has(end.segment)) issue(`${p}.segment`, `unknown segment ${end.segment}`)
      } else if (typeof end.routingDomain === 'string') {
        if (!domainIds.has(end.routingDomain))
          issue(`${p}.routingDomain`, `unknown routing domain ${end.routingDomain}`)
      } else if (typeof end.node === 'string' && !nodeIds.has(end.node)) {
        // Writers reach for links to say "attached to"; name what the id is and where it goes.
        const id = end.node
        issue(
          `${p}.node`,
          segmentIds.has(id)
            ? `${id} is a segment; write this end as { segment: ${id} }`
            : domainIds.has(id)
              ? `${id} is a routing domain; write this end as { routingDomain: ${id} }`
              : setIds.has(id)
                ? `${id} is a redundancy set, not a node; link to one of its nodes`
                : `unknown node ${id}`,
        )
      }
    }
    const [a, b] = ends.map((e) => record(e, '', true))
    if (a && b && !('node' in a) && !('node' in b))
      issue(`${link.path}.endpoints`, 'a link needs a node on at least one end')
    if (a && b && typeof a.node === 'string' && a.node === b.node)
      issue(`${link.path}.endpoints`, `both ends on ${a.node}`)
    const { connection, segments: carried } = link.fields
    if (typeof connection === 'string' && !connectionIds.has(connection))
      issue(`${link.path}.connection`, `unknown connection ${connection}`)
    for (const [i, s] of items(carried, '', true)) {
      if (typeof s === 'string' && !segmentIds.has(s))
        issue(`${link.path}.segments[${i}]`, `unknown segment ${s}`)
    }
  }
  return issues

  // ----- helpers that report into `issues` -----

  function entries(
    list: unknown,
    path: string,
    keys: readonly string[],
    check: (item: Fields, path: string) => void,
  ): { id: string; path: string; fields: Fields }[] {
    return [...items(list, path)].flatMap(([i, item]) => {
      const p = `${path}[${i}]`
      const fieldsOf = record(item, p)
      if (!fieldsOf) return []
      only(fieldsOf, keys, p)
      // A link's id is optional; everything else is named by one.
      const id =
        keys === LINK
          ? typeof fieldsOf.id === 'string'
            ? fieldsOf.id
            : ''
          : string(fieldsOf.id, `${p}.id`)
      check(fieldsOf, p)
      return id !== undefined ? [{ id, path: p, fields: fieldsOf }] : []
    })
  }

  function endpoint(value: unknown, path: string) {
    const end = record(value, path)
    if (!end) return
    if (end.segment !== undefined) {
      only(end, ['segment'], path)
      string(end.segment, `${path}.segment`)
    } else if (end.routingDomain !== undefined) {
      only(end, ['routingDomain'], path)
      string(end.routingDomain, `${path}.routingDomain`)
    } else {
      only(end, NODE_END, path)
      string(end.node, `${path}.node`)
      // YAML reads a port named 1 as a number; that is still its name.
      if (typeof end.port !== 'number') optionalString(end.port, `${path}.port`)
    }
  }

  function only(o: Fields, keys: readonly string[], path: string) {
    for (const [k, v] of Object.entries(o)) {
      // A writer who knows the format only from an example guesses names; the list ends that.
      if (!keys.includes(k)) {
        const near = closest(k, keys)
        issue(
          at(path, k),
          `unknown field${near ? `; did you mean ${near}?` : '.'} The fields here are ${keys.join(', ')}`,
        )
      } else if (v === null) {
        // An empty value reads as a fact; what is not known is not written.
        issue(at(path, k), 'empty; leave it out when it is not known')
      }
    }
  }

  function record(v: unknown, path: string, quiet = false): Fields | undefined {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Fields
    if (!quiet && v !== undefined && v !== null) issue(path, 'expected fields, such as { id: … }')
    return undefined
  }

  function* items(v: unknown, path: string, quiet = false): Generator<[number, unknown]> {
    if (v === undefined || v === null) return
    if (!Array.isArray(v)) {
      if (!quiet) issue(path, 'expected a list')
      return
    }
    yield* v.entries()
  }

  function string(v: unknown, path: string): string | undefined {
    if (typeof v === 'string' && v !== '') return v
    issue(
      path,
      v === undefined
        ? 'missing'
        : typeof v === 'number'
          ? `expected text; quote it, as '${v}'`
          : 'expected text',
    )
    return undefined
  }

  function optionalString(v: unknown, path: string): string | undefined {
    return v === undefined || v === null ? undefined : string(v, path)
  }

  function optionalStrings(v: unknown, path: string) {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) {
      if (v.length === 0) issue(path, 'empty; leave it out')
      for (const [i, x] of v.entries()) string(x, `${path}[${i}]`)
    } else string(v, path)
  }

  function optionalInteger(v: unknown, path: string, min: number, max: number) {
    if (v === undefined || v === null) return
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
      issue(path, `expected a whole number from ${min} to ${max}`)
  }

  function optionalTrue(v: unknown, path: string) {
    if (v !== undefined && v !== null && v !== true)
      issue(path, 'expected true, or leave it out; leaving it out already means no')
  }

  function optionalRate(v: unknown, path: string): input.Rate | undefined {
    if (v === undefined || v === null) return undefined
    if (typeof v === 'string' && /^\d+(\.\d+)?[MGT]$/.test(v) && Number.parseFloat(v) > 0)
      return v as input.Rate
    issue(path, 'expected a number and M, G or T, such as 2.5G')
    return undefined
  }

  function unique(list: readonly { id: string; path: string }[], kind: string): Set<string> {
    const ids = new Set<string>()
    for (const { id, path } of list) {
      if (ids.has(id)) issue(`${path}.id`, `another ${kind} already has the id ${id}`)
      ids.add(id)
    }
    return ids
  }
}

/** A segment's addresses, keyed by the node or redundancy set holding them. */
function addressMap(v: unknown): Readonly<Record<string, unknown>> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function addressList(written: unknown): string[] {
  if (typeof written === 'string') return [written]
  return Array.isArray(written) ? written.filter(isString) : []
}

function bitsPerSecond(rate: input.Rate): number {
  const unit = { M: 1e6, G: 1e9, T: 1e12 }[rate.slice(-1) as 'M' | 'G' | 'T']
  return Number.parseFloat(rate) * unit
}

/** The field a misspelt one most likely means, if one is close enough. */
function closest(written: string, keys: readonly string[]): string | undefined {
  let best: { key: string; distance: number } | undefined
  for (const key of keys) {
    const distance = editDistance(written.toLowerCase(), key.toLowerCase())
    if (!best || distance < best.distance) best = { key, distance }
  }
  return best && best.distance <= Math.max(1, Math.round(best.key.length / 3))
    ? best.key
    : undefined
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (const [i, ca] of [...a].entries()) {
    const current = [i + 1]
    for (const [j, cb] of [...b].entries()) {
      current.push(
        Math.min(
          (previous[j + 1] ?? 0) + 1,
          (current[j] ?? 0) + 1,
          (previous[j] ?? 0) + (ca === cb ? 0 : 1),
        ),
      )
    }
    previous = current
  }
  return previous[b.length] ?? 0
}
