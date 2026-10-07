/**
 * Anything not written is unknown, not absent: a link without `segments` may still carry some,
 * and a node without links may still be connected somewhere. A link that lists its segments
 * carries those and no others. Other lists, such as a segment's addresses, may be partial.
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
 * A separate routing domain that segments and nodes belong to, such as a VPC, a cloud virtual
 * network or a VRF. Write one only when such a domain is known; a network with a single routing
 * table has none, and a subnet or a place is not one.
 */
export interface RoutingDomain {
  id: string
  label?: string
  prefix?: string
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
 * cloud subnet. A link that carries a segment puts both of its ends in it.
 */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  prefix?: string
  /** The routing domain the segment belongs to. */
  routingDomain?: string
  /** The place the segment is confined to, such as an availability zone. Most VLANs span places. */
  group?: string
  /**
   * Every address a node has, by node. An address belongs to a node's presence in a segment
   * rather than to a port, so a trunk carries one per VLAN and an SVI needs no port at all.
   * A node can be in a segment without a known link into it.
   * A virtual address shared by a redundancy set is written under the set's id.
   * A single address may be written without the list.
   */
  addresses?: Record<string, string | string[]>
}

export interface Node {
  id: string
  label?: string
  type?: string
  /**
   * The product this node is one of, whether that product is a box, a virtual appliance or a
   * cloud service: a path from its maker down to as specific as is known, such as `juniper`,
   * `juniper/ex4400` or `juniper/ex4400/ex4400-48p`.
   */
  product?: string
  /** The software this node runs, such as its operating system or hypervisor. */
  software?: string
  /**
   * The routing domain this node is attached to or part of as a whole, such as an internet
   * gateway attached to a VPC. A node in a segment is already part of that segment's domain.
   */
  routingDomain?: string
  /**
   * An address whose segment is not known. Once the segment is known, write the address
   * in that segment instead.
   */
  address?: string
  description?: string
  group?: string
  /** True when the node is believed to exist but not confirmed. */
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

export const speeds = ['100M', '1G', '2.5G', '10G', '25G', '40G', '100G', '400G'] as const
export type Speed = (typeof speeds)[number]

/**
 * Undirected: the two endpoints have no order. Two nodes may have several links, such as
 * parallel cables or the two tunnels of one VPN.
 */
export interface Link {
  endpoints: [Endpoint, Endpoint]
  speed?: Speed
  /** The segments the link carries. Both ends of the link are in each of them. */
  segments?: string[]
  description?: string
  /** The connection this link is one part of. */
  connection?: string
  /** True when the connection is believed to exist but not confirmed. */
  assumed?: true
  /**
   * True when the connection is not a cable, such as a VPN tunnel or a VM's adapter in a port
   * group.
   */
  virtual?: true
}

/**
 * One end of a link: a node (a port is optional, because many sources know only which nodes are
 * connected), or a segment, when a node is attached to a shared network and what is on the other
 * side is not a single node, such as a gateway attached through a subnet or a VM's adapter in a
 * port group. A link to a segment puts the node in that segment.
 */
export type Endpoint = NodeEnd | SegmentEnd
export interface NodeEnd {
  node: string
  port?: string
}
export interface SegmentEnd {
  segment: string
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
  for (const item of [...nodes, ...segments]) {
    if (item.routingDomain && !domainIds.has(item.routingDomain))
      throw new ModelError(`${item.id}: unknown routing domain ${item.routingDomain}`)
  }
  const segmentIds = unique(segments, 'segment')
  const nodeIds = unique(nodes, 'node')
  // Segment addresses are keyed by node or by redundancy set, so the two share one namespace.
  const holderIds = unique([...nodes, ...redundancy], 'node or redundancy')
  // Writers reach for links to say "attached to"; name what the id is and where it goes instead.
  const notANode = (id: string) => {
    if (segmentIds.has(id)) return `${id} is a segment; write this end as { segment: ${id} }`
    if (domainIds.has(id))
      return `${id} is a routing domain, not a node; set the node's routingDomain instead`
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
      throw new ModelError(`${item.id}: unknown group ${item.group}`)
  }
  for (const node of nodes) {
    if (node.host === undefined) continue
    if (!holderIds.has(node.host))
      throw new ModelError(`node ${node.id}: unknown host ${node.host}`)
    // Nested virtualization is real, so hosts may chain, but not back to where they started.
    const below = new Set([node.id])
    let next: string | undefined = node.host
    while (next) {
      const set = redundancy.find((r) => r.id === next)
      if (below.has(next) || set?.nodes.some((m) => below.has(m)))
        throw new ModelError(`node ${node.id}: host cycle`)
      below.add(next)
      next = nodes.find((n) => n.id === next)?.host
    }
  }
  for (const [i, link] of links.entries()) {
    for (const end of link.endpoints) {
      if ('segment' in end) {
        if (!segmentIds.has(end.segment))
          throw new ModelError(`links[${i}]: unknown segment ${end.segment}`)
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
  return {
    id: string(n.id, `${at}.id`),
    label: optionalString(n.label, `${at}.label`),
    prefix: optionalString(n.prefix, `${at}.prefix`),
  }
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
            nonEmpty(a, `${at}.addresses.${node}`).map((x, i) =>
              string(x, `${at}.addresses.${node}[${i}]`),
            ),
          ]),
        )
  return {
    id: string(s.id, `${at}.id`),
    label: optionalString(s.label, `${at}.label`),
    vlan: optionalVlan(s.vlan, `${at}.vlan`),
    prefix: optionalString(s.prefix, `${at}.prefix`),
    routingDomain: optionalString(s.routingDomain, `${at}.routingDomain`),
    group: optionalString(s.group, `${at}.group`),
    addresses,
  }
}

/** An address list is never empty: a node whose address is not known lists the segment. */
function nonEmpty(a: unknown, at: string): unknown[] {
  const listed = Array.isArray(a) ? a : [a]
  if (listed.length === 0) throw new ModelError(`${at}: empty; list the segment on the node`)
  return listed
}

function parseRedundancy(input: unknown, at: string): Redundancy {
  const r = record(input, at)
  only(r, ['id', 'label', 'nodes', 'assumed'], at)
  const nodes = list(r.nodes, `${at}.nodes`).map((n, i) => string(n, `${at}.nodes[${i}]`))
  if (new Set(nodes).size < 2)
    throw new ModelError(`${at}.nodes: expected at least 2 distinct nodes`)
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
      'routingDomain',
      'address',
      'description',
      'group',
      'assumed',
      'host',
      'members',
    ],
    at,
  )
  const product = optionalString(n.product, `${at}.product`)
  if (product?.split('/').some((part) => part === ''))
    throw new ModelError(`${at}.product: empty step in ${product}`)
  const members =
    n.members === undefined
      ? undefined
      : list(n.members, `${at}.members`).map((m, i) => string(m, `${at}.members[${i}]`))
  if (members && members.length < 2) throw new ModelError(`${at}.members: expected at least 2`)
  return {
    id: string(n.id, `${at}.id`),
    label: optionalString(n.label, `${at}.label`),
    type: optionalString(n.type, `${at}.type`),
    product,
    software: optionalString(n.software, `${at}.software`),
    routingDomain: optionalString(n.routingDomain, `${at}.routingDomain`),
    address: optionalString(n.address, `${at}.address`),
    description: optionalString(n.description, `${at}.description`),
    group: optionalString(n.group, `${at}.group`),
    assumed: optionalTrue(n.assumed, `${at}.assumed`),
    host: optionalString(n.host, `${at}.host`),
    members,
  }
}

function parseLink(input: unknown, at: string): Link {
  const l = record(input, at)
  only(l, ['endpoints', 'speed', 'segments', 'description', 'connection', 'assumed', 'virtual'], at)
  const ends = list(l.endpoints, `${at}.endpoints`)
  if (ends.length !== 2) throw new ModelError(`${at}.endpoints: expected exactly 2`)
  const [a, b] = ends.map((e, i) => parseEndpoint(e, `${at}.endpoints[${i}]`))
  if (!a || !b) throw new ModelError(`${at}.endpoints: expected exactly 2`)
  if (l.speed !== undefined && !speeds.includes(l.speed as Speed))
    throw new ModelError(`${at}.speed: expected one of ${speeds.join(', ')}`)
  const segments = optionalList(l.segments, `${at}.segments`).map((s, i) =>
    string(s, `${at}.segments[${i}]`),
  )
  return {
    endpoints: [a, b],
    speed: l.speed as Speed | undefined,
    ...(segments.length > 0 && { segments }),
    description: optionalString(l.description, `${at}.description`),
    connection: optionalString(l.connection, `${at}.connection`),
    assumed: optionalTrue(l.assumed, `${at}.assumed`),
    virtual: optionalTrue(l.virtual, `${at}.virtual`),
  }
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

function optionalVlan(v: unknown, at: string): number | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 4094)
    throw new ModelError(`${at}: expected 1-4094`)
  return v
}

function only(o: Record<string, unknown>, keys: string[], at: string) {
  for (const k of Object.keys(o)) {
    if (!keys.includes(k)) throw new ModelError(`${at}: unknown field ${k}`)
  }
}
