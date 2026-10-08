/**
 * What is written is known, and anything not written is unknown, not absent: a link without
 * `segments` may still carry some, and a node without links may still be connected somewhere.
 * A written node or link is known to exist unless it is marked assumed. A link that lists its
 * segments carries those and no others. Other lists, such as a segment's addresses, may be partial.
 */
export interface Network {
  name?: string
  description?: string
  groups?: Group[]
  routingDomains?: RoutingDomain[]
  connections?: Connection[]
  segments?: Segment[]
  redundancy?: Redundancy[]
  nodes: Node[]
  links: Link[]
}

/**
 * A separate routing domain that segments belong to, such as a VPC, a cloud virtual network or
 * a VRF. Write one only when such a domain is known; a network with a single routing
 * table has none, and a subnet, a place or an autonomous system is not one (see a node's asn).
 */
export interface RoutingDomain {
  id: string
  label?: string
  /** The domain's prefixes, such as a VPC's IPv4 and IPv6 ranges. A single one may be written bare. */
  prefix?: string | string[]
}

/** One logical connection made of several links, such as a VPN made of two tunnels. */
export interface Connection {
  id: string
  label?: string
}

/** A place: site, building, room. Nested through `parent`. */
export interface Group {
  id: string
  label?: string
  parent?: string
}

/**
 * A shared network that any number of links can carry, such as a VLAN, a handoff segment or a
 * cloud subnet. A node is in a segment when it has an address there, when a link carrying the
 * segment ends at it, or when a link joins it to the segment itself.
 */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  /** The segment's prefixes, such as one IPv4 and one IPv6. A single prefix may be written without the list. */
  prefix?: string | string[]
  /** The routing domain the segment belongs to. */
  routingDomain?: string
  /** The place the segment is confined to, such as an availability zone. Most VLANs span places. */
  group?: string
  /**
   * The addresses nodes have in the segment, by node. An address belongs to a node's presence in a segment
   * rather than to a port, so a trunk carries one per VLAN and an SVI needs no port at all.
   * A node can be in a segment without a known link into it.
   * A virtual address shared by a redundancy set is written under the set's id.
   * A single address may be written without the list.
   */
  addresses?: Record<string, string | string[]>
}

export interface Node {
  id: string
  /** The node's name. Left out when the name is not known; the id is then only a handle. */
  label?: string
  type?: string
  /**
   * The product this node is one of, whether that product is a box, a virtual appliance or a
   * cloud service: a path from its maker down to as specific as is known, such as `juniper`,
   * `juniper/ex4400` or `juniper/ex4400/ex4400-48p`. When the maker is not known, it is written
   * `?`, such as `?/ex4400-48p`.
   */
  product?: string
  /** The software this node runs, such as its operating system or hypervisor. */
  software?: string
  /**
   * An address whose segment is not known. Once the segment is known, write the address
   * in that segment instead.
   */
  address?: string
  /** The autonomous system number this node is in, such as a router's local AS. */
  asn?: number
  description?: string
  group?: string
  /**
   * True when whether the node exists at all is not confirmed. Details that are not known are
   * left out, not marked assumed.
   */
  assumed?: true
  /**
   * The node this one runs on, such as the host of a VM. A redundancy set's id means it runs on
   * one of the set's nodes, and which one is not known.
   */
  host?: string
  /**
   * Names of the devices one node stands for when their links are not told apart,
   * such as the units of a stack. A link to the node lands on a member nobody can name.
   */
  members?: string[]
}

/** Separate nodes that stand in for one another, such as a VRRP pair or an HA cluster. */
export interface Redundancy {
  id: string
  label?: string
  nodes: string[]
  /** True when the pairing is believed but not confirmed. */
  assumed?: true
}

/** The IEEE 802.3 Ethernet rates. (5G, 800G and 1.6T appeared in real data the first list lacked.) */
export const speeds = [
  '10M',
  '100M',
  '1G',
  '2.5G',
  '5G',
  '10G',
  '25G',
  '40G',
  '50G',
  '100G',
  '200G',
  '400G',
  '800G',
  '1.6T',
] as const
export type Speed = (typeof speeds)[number]

/**
 * Undirected: the two endpoints have no order. Two nodes may have several links, such as
 * parallel cables or the two tunnels of one VPN.
 */
export interface Link {
  endpoints: [Endpoint, Endpoint]
  speed?: Speed
  /** The cable's type, such as cat6, mmf-om4, smf or dac. */
  cable?: string
  /** The cable's length with its unit, such as 3m. */
  length?: string
  /** The segments the link carries. Both ends of the link are in each of them. */
  segments?: string[]
  description?: string
  /** The connection this link is one part of. */
  connection?: string
  /**
   * True when whether the connection exists at all is not confirmed. Unknown ports or segments
   * are left out, not marked assumed.
   */
  assumed?: true
  /**
   * True when the connection has no cable of its own, such as a VPN tunnel, a VM's adapter in a
   * port group, or a BGP session between two routers across a shared LAN. A link whose way is
   * not known is neither virtual nor given a cable.
   */
  virtual?: true
}

/**
 * One end of a link. A link joins a node to one of:
 * - another node. A port is optional, because many sources know only which nodes are connected.
 * - a segment. The node is in that segment, such as a gateway attached through a subnet or a VM's
 *   adapter in a port group.
 * - a routing domain. The node is attached to the domain as a whole, such as an internet gateway
 *   attached to a VPC.
 */
export type Endpoint = NodeEnd | SegmentEnd | RoutingDomainEnd
export interface NodeEnd {
  node: string
  port?: string
}
export interface SegmentEnd {
  segment: string
}
export interface RoutingDomainEnd {
  routingDomain: string
}

export class ModelError extends Error {}

/** One address is written bare and several as a list; readers take both as a list. */
export function addressList(written: string | string[] | undefined): string[] {
  if (written === undefined) return []
  return Array.isArray(written) ? written : [written]
}

export function parseNetwork(input: unknown): Network {
  const root = record(input, 'network')
  only(
    root,
    [
      'name',
      'description',
      'groups',
      'routingDomains',
      'connections',
      'segments',
      'redundancy',
      'nodes',
      'links',
    ],
    'network',
  )
  const groups = optionalList(root.groups, 'groups').map((g, i) => parseGroup(g, `groups[${i}]`))
  const routingDomains = optionalList(root.routingDomains, 'routingDomains').map((d, i) =>
    parseRoutingDomain(d, `routingDomains[${i}]`),
  )
  const connections = optionalList(root.connections, 'connections').map((c, i) =>
    parseConnection(c, `connections[${i}]`),
  )
  const segments = optionalList(root.segments, 'segments').map((s, i) =>
    parseSegment(s, `segments[${i}]`),
  )
  const redundancy = optionalList(root.redundancy, 'redundancy').map((r, i) =>
    parseRedundancy(r, `redundancy[${i}]`),
  )
  const nodes = list(root.nodes, 'nodes').map((n, i) => parseNode(n, `nodes[${i}]`))
  const links = list(root.links, 'links').map((l, i) => parseLink(l, `links[${i}]`))

  const groupIds = unique(groups, 'group')
  const domainIds = unique(routingDomains, 'routing domain')
  const connectionIds = unique(connections, 'connection')
  for (const segment of segments) {
    if (segment.routingDomain && !domainIds.has(segment.routingDomain))
      throw new ModelError(`segment ${segment.id}: unknown routing domain ${segment.routingDomain}`)
  }
  const segmentIds = unique(segments, 'segment')
  const nodeIds = unique(nodes, 'node')
  // Segment addresses are keyed by node or by redundancy set, so the two share one namespace.
  const holderIds = unique([...nodes, ...redundancy], 'node or redundancy')
  // Writers reach for links to say "attached to"; name what the id is and where it goes instead.
  const notANode = (id: string) => {
    if (segmentIds.has(id)) return `${id} is a segment; write this end as { segment: ${id} }`
    if (domainIds.has(id))
      return `${id} is a routing domain; write this end as { routingDomain: ${id} }`
    if (redundancy.some((r) => r.id === id))
      return `${id} is a redundancy set, not a node; link to one of its nodes`
    return `unknown node ${id}`
  }
  for (const set of redundancy) {
    for (const node of set.nodes) {
      if (!nodeIds.has(node)) throw new ModelError(`redundancy ${set.id}: unknown node ${node}`)
    }
  }
  for (const group of groups) {
    if (group.parent && !groupIds.has(group.parent))
      throw new ModelError(`group ${group.id}: unknown parent ${group.parent}`)
    const above = new Set([group.id])
    let next = group.parent
    while (next) {
      if (above.has(next)) throw new ModelError(`group ${group.id}: parent cycle`)
      above.add(next)
      next = groups.find((g) => g.id === next)?.parent
    }
  }
  for (const item of [...nodes, ...segments]) {
    if (item.group && !groupIds.has(item.group))
      throw new ModelError(`${item.id}: unknown group ${item.group}; list it under groups`)
  }
  for (const node of nodes) {
    if (node.host === undefined) continue
    if (!holderIds.has(node.host))
      throw new ModelError(`node ${node.id}: unknown host ${node.host}`)
  }
  // Nested virtualization is real, so hosts may chain, but no choice of host may lead back to
  // where it started. A set may run its guest on any of its nodes, so it leads to each of them.
  const runsOn = (id: string): string[] =>
    redundancy.find((r) => r.id === id)?.nodes ??
    [nodes.find((n) => n.id === id)?.host ?? []].flat()
  const settled = new Set<string>()
  const visit = (id: string, path: string[]) => {
    if (path.includes(id)) throw new ModelError(`node ${path[0]}: host cycle`)
    if (settled.has(id)) return
    for (const next of runsOn(id)) visit(next, [...path, id])
    settled.add(id)
  }
  for (const node of nodes) visit(node.id, [])
  for (const [i, link] of links.entries()) {
    for (const end of link.endpoints) {
      if ('segment' in end) {
        if (!segmentIds.has(end.segment))
          throw new ModelError(`links[${i}]: unknown segment ${end.segment}`)
      } else if ('routingDomain' in end) {
        if (!domainIds.has(end.routingDomain))
          throw new ModelError(`links[${i}]: unknown routing domain ${end.routingDomain}`)
      } else if (!nodeIds.has(end.node)) throw new ModelError(`links[${i}]: ${notANode(end.node)}`)
    }
    const [a, b] = link.endpoints
    if (!('node' in a) && !('node' in b))
      throw new ModelError(`links[${i}]: a link needs a node on at least one end`)
    if ('node' in a && 'node' in b && a.node === b.node)
      throw new ModelError(`links[${i}]: both ends on ${a.node}`)
    if (link.connection && !connectionIds.has(link.connection))
      throw new ModelError(`links[${i}]: unknown connection ${link.connection}`)
    for (const s of link.segments ?? []) {
      if (!segmentIds.has(s)) throw new ModelError(`links[${i}]: unknown segment ${s}`)
    }
  }
  for (const segment of segments) {
    for (const holder of Object.keys(segment.addresses ?? {})) {
      if (!holderIds.has(holder))
        throw new ModelError(`segment ${segment.id}: unknown node or redundancy ${holder}`)
    }
  }
  for (const node of nodes) {
    const { address } = node
    if (address && segments.some((s) => addressList(s.addresses?.[node.id]).includes(address)))
      throw new ModelError(`node ${node.id}: ${node.address} is in a segment; drop node.address`)
  }
  return {
    name: optionalString(root.name, 'name'),
    description: optionalString(root.description, 'description'),
    ...(groups.length > 0 && { groups }),
    ...(routingDomains.length > 0 && { routingDomains }),
    ...(connections.length > 0 && { connections }),
    ...(segments.length > 0 && { segments }),
    ...(redundancy.length > 0 && { redundancy }),
    nodes,
    links,
  }
}

function parseGroup(input: unknown, at: string): Group {
  const g = record(input, at)
  only(g, ['id', 'label', 'parent'], at)
  return {
    id: string(g.id, `${at}.id`),
    label: optionalString(g.label, `${at}.label`),
    parent: optionalString(g.parent, `${at}.parent`),
  }
}

function parseRoutingDomain(input: unknown, at: string): RoutingDomain {
  const n = record(input, at)
  only(n, ['id', 'label', 'prefix'], at)
  const domain = {
    id: string(n.id, `${at}.id`),
    label: optionalString(n.label, `${at}.label`),
    prefix: n.prefix === undefined ? undefined : strings(n.prefix, `${at}.prefix`),
  }
  // "Routing domain" also names an AS in routing, and writers reach for it to hold one.
  if ([domain.id, domain.label].some((name) => name !== undefined && /^as[\s_-]?\d+$/i.test(name)))
    throw new ModelError(
      `${at}: an AS is not a routing domain; write its number as asn on its nodes`,
    )
  return domain
}

function parseConnection(input: unknown, at: string): Connection {
  const c = record(input, at)
  only(c, ['id', 'label'], at)
  return { id: string(c.id, `${at}.id`), label: optionalString(c.label, `${at}.label`) }
}

function parseSegment(input: unknown, at: string): Segment {
  const s = record(input, at)
  only(s, ['id', 'label', 'vlan', 'prefix', 'routingDomain', 'group', 'addresses'], at)
  const addresses =
    s.addresses === undefined
      ? undefined
      : Object.fromEntries(
          // One address is written bare; several are written as a list.
          Object.entries(record(s.addresses, `${at}.addresses`)).map(([node, a]) => [
            node,
            strings(a, `${at}.addresses.${node}`),
          ]),
        )
  return {
    id: string(s.id, `${at}.id`),
    label: optionalString(s.label, `${at}.label`),
    vlan: optionalInteger(s.vlan, `${at}.vlan`, 1, 4094),
    prefix: s.prefix === undefined ? undefined : strings(s.prefix, `${at}.prefix`),
    routingDomain: optionalString(s.routingDomain, `${at}.routingDomain`),
    group: optionalString(s.group, `${at}.group`),
    addresses,
  }
}

/**
 * One value is written bare; several are written as a list, which is never empty: a node whose
 * address is not known is left out of the addresses and linked to the segment.
 */
function strings(a: unknown, at: string): string[] {
  const listed = Array.isArray(a) ? a : [a]
  if (listed.length === 0) throw new ModelError(`${at}: empty; leave it out`)
  return listed.map((x, i) => string(x, `${at}[${i}]`))
}

function parseRedundancy(input: unknown, at: string): Redundancy {
  const r = record(input, at)
  only(r, ['id', 'label', 'nodes', 'assumed'], at)
  const nodes = list(r.nodes, `${at}.nodes`).map((n, i) => string(n, `${at}.nodes[${i}]`))
  if (new Set(nodes).size !== nodes.length)
    throw new ModelError(`${at}.nodes: a node is listed twice`)
  if (nodes.length < 2) throw new ModelError(`${at}.nodes: expected at least 2 nodes`)
  return {
    id: string(r.id, `${at}.id`),
    label: optionalString(r.label, `${at}.label`),
    nodes,
    assumed: optionalTrue(r.assumed, `${at}.assumed`),
  }
}

function parseNode(input: unknown, at: string): Node {
  const n = record(input, at)
  only(
    n,
    [
      'id',
      'label',
      'type',
      'product',
      'software',
      'address',
      'asn',
      'description',
      'group',
      'assumed',
      'host',
      'members',
    ],
    at,
  )
  const product = optionalString(n.product, `${at}.product`)
  const steps = product?.split('/') ?? []
  if (steps.some((step) => step === ''))
    throw new ModelError(`${at}.product: empty step in ${product}`)
  if (steps.slice(1).includes('?') || (steps[0] === '?' && steps.length < 2))
    throw new ModelError(`${at}.product: only the maker may be ?, and a model must follow it`)
  const members =
    n.members === undefined
      ? undefined
      : list(n.members, `${at}.members`).map((m, i) => string(m, `${at}.members[${i}]`))
  if (members && new Set(members).size !== members.length)
    throw new ModelError(`${at}.members: a member is listed twice`)
  if (members && members.length < 2) throw new ModelError(`${at}.members: expected at least 2`)
  return {
    id: string(n.id, `${at}.id`),
    label: optionalString(n.label, `${at}.label`),
    type: optionalString(n.type, `${at}.type`),
    product,
    software: optionalString(n.software, `${at}.software`),
    address: optionalString(n.address, `${at}.address`),
    asn: optionalInteger(n.asn, `${at}.asn`, 1, 4294967295),
    description: optionalString(n.description, `${at}.description`),
    group: optionalString(n.group, `${at}.group`),
    assumed: optionalTrue(n.assumed, `${at}.assumed`),
    host: optionalString(n.host, `${at}.host`),
    members,
  }
}

function parseLink(input: unknown, at: string): Link {
  const l = record(input, at)
  only(
    l,
    [
      'endpoints',
      'speed',
      'cable',
      'length',
      'segments',
      'description',
      'connection',
      'assumed',
      'virtual',
    ],
    at,
  )
  const ends = list(l.endpoints, `${at}.endpoints`)
  if (ends.length !== 2)
    throw new ModelError(
      `${at}.endpoints: a link has exactly 2 ends; write one link for each pair, or a segment for a shared network`,
    )
  const [a, b] = ends.map((e, i) => parseEndpoint(e, `${at}.endpoints[${i}]`))
  if (!a || !b) throw new ModelError(`${at}.endpoints: expected exactly 2`)
  if (l.speed !== undefined && !speeds.includes(l.speed as Speed))
    throw new ModelError(`${at}.speed: expected one of ${speeds.join(', ')}`)
  const segments = optionalList(l.segments, `${at}.segments`).map((s, i) =>
    string(s, `${at}.segments[${i}]`),
  )
  if (l.segments !== undefined && !('node' in a && 'node' in b))
    throw new ModelError(`${at}.segments: only a link between two nodes carries segments`)
  return {
    endpoints: [a, b],
    speed: l.speed as Speed | undefined,
    ...cableFields(l, at),
    ...(l.segments !== undefined && { segments }),
    description: optionalString(l.description, `${at}.description`),
    connection: optionalString(l.connection, `${at}.connection`),
    assumed: optionalTrue(l.assumed, `${at}.assumed`),
    virtual: optionalTrue(l.virtual, `${at}.virtual`),
  }
}

/** A cable is physical: a virtual link has none, and a length always says its unit. */
function cableFields(l: Record<string, unknown>, at: string): { cable?: string; length?: string } {
  const cable = optionalString(l.cable, `${at}.cable`)
  const length = optionalString(l.length, `${at}.length`)
  if ((cable || length) && l.virtual === true)
    throw new ModelError(`${at}: a virtual link has no cable`)
  if (length && !/^\d+(\.\d+)?\s?(mm|cm|m|km|in|ft)$/.test(length))
    throw new ModelError(`${at}.length: expected a number and a unit, such as 3m`)
  return { ...(cable && { cable }), ...(length && { length }) }
}

/** Only `true` is written; leaving the field out already means "not assumed". */
function optionalTrue(v: unknown, at: string): true | undefined {
  if (v === undefined) return undefined
  if (v !== true) throw new ModelError(`${at}: expected true or omitted`)
  return true
}

function parseEndpoint(input: unknown, at: string): Endpoint {
  const e = record(input, at)
  if (e.segment !== undefined) {
    only(e, ['segment'], at)
    return { segment: string(e.segment, `${at}.segment`) }
  }
  if (e.routingDomain !== undefined) {
    only(e, ['routingDomain'], at)
    return { routingDomain: string(e.routingDomain, `${at}.routingDomain`) }
  }
  only(e, ['node', 'port'], at)
  return {
    node: string(e.node, `${at}.node`),
    port: optionalString(e.port, `${at}.port`),
  }
}

function unique(items: { id: string }[], kind: string): Set<string> {
  const ids = new Set<string>()
  for (const { id } of items) {
    if (ids.has(id)) throw new ModelError(`duplicate ${kind} id: ${id}`)
    ids.add(id)
  }
  return ids
}

function record(v: unknown, at: string): Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v))
    throw new ModelError(`${at}: expected object`)
  return v as Record<string, unknown>
}

function list(v: unknown, at: string): unknown[] {
  if (!Array.isArray(v)) throw new ModelError(`${at}: expected list`)
  return v
}

function optionalList(v: unknown, at: string): unknown[] {
  return v === undefined ? [] : list(v, at)
}

function string(v: unknown, at: string): string {
  if (typeof v !== 'string' || v === '') throw new ModelError(`${at}: expected non-empty string`)
  return v
}

function optionalString(v: unknown, at: string): string | undefined {
  return v === undefined ? undefined : string(v, at)
}

function optionalInteger(v: unknown, at: string, min: number, max: number): number | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new ModelError(`${at}: expected ${min}-${max}`)
  return v
}

function only(o: Record<string, unknown>, keys: string[], at: string) {
  for (const k of Object.keys(o)) {
    if (!keys.includes(k)) throw new ModelError(`${at}: unknown field ${k}`)
    // An empty value reads as a fact; what is not known is not written.
    if (o[k] === null) throw new ModelError(`${at}.${k}: empty; leave it out when it is not known`)
  }
}
