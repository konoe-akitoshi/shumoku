export interface Network {
  name?: string
  description?: string
  groups?: Group[]
  segments?: Segment[]
  nodes: Node[]
  links: Link[]
}

/** A place: site, building, room. Nested through `parent`. */
export interface Group {
  id: string
  label?: string
  parent?: string
}

/** A shared L2 network that any number of links can carry, such as a VLAN or a handoff segment. */
export interface Segment {
  id: string
  label?: string
  vlan?: number
  prefix?: string
}

export interface Node {
  id: string
  label?: string
  type?: string
  vendor?: string
  /** Meaningful only with `vendor`, because the catalog is keyed by both. */
  model?: string
  /** Management address. Interface addresses belong to link endpoints. */
  address?: string
  description?: string
  group?: string
  /** True when the node is believed to exist but not confirmed. */
  assumed?: true
  /**
   * Set when one node stands for several devices whose links are not told apart,
   * such as an HA pair. The addresses then belong to the members.
   */
  members?: Member[]
}

export interface Member {
  label?: string
  address?: string
}

export const speeds = ['100M', '1G', '2.5G', '10G', '25G', '40G', '100G', '400G'] as const
export type Speed = (typeof speeds)[number]

/** Undirected: the two endpoints have no order. */
export interface Link {
  endpoints: [Endpoint, Endpoint]
  speed?: Speed
  segments?: string[]
  description?: string
  /** True when the connection is believed to exist but not confirmed. */
  assumed?: true
}

/** A port is optional because many sources know only which nodes are connected. */
export interface Endpoint {
  node: string
  port?: string
  address?: string
}

export class ModelError extends Error {}

export function parseNetwork(input: unknown): Network {
  const root = record(input, 'network')
  only(root, ['name', 'description', 'groups', 'segments', 'nodes', 'links'], 'network')
  const groups = optionalList(root.groups, 'groups').map((g, i) => parseGroup(g, `groups[${i}]`))
  const segments = optionalList(root.segments, 'segments').map((s, i) =>
    parseSegment(s, `segments[${i}]`),
  )
  const nodes = list(root.nodes, 'nodes').map((n, i) => parseNode(n, `nodes[${i}]`))
  const links = list(root.links, 'links').map((l, i) => parseLink(l, `links[${i}]`))

  const groupIds = unique(groups, 'group')
  const segmentIds = unique(segments, 'segment')
  const nodeIds = unique(nodes, 'node')
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
  for (const node of nodes) {
    if (node.group && !groupIds.has(node.group))
      throw new ModelError(`node ${node.id}: unknown group ${node.group}`)
  }
  for (const [i, link] of links.entries()) {
    for (const end of link.endpoints) {
      if (!nodeIds.has(end.node)) throw new ModelError(`links[${i}]: unknown node ${end.node}`)
    }
    for (const s of link.segments ?? []) {
      if (!segmentIds.has(s)) throw new ModelError(`links[${i}]: unknown segment ${s}`)
    }
  }
  return {
    name: optionalString(root.name, 'name'),
    description: optionalString(root.description, 'description'),
    ...(groups.length > 0 && { groups }),
    ...(segments.length > 0 && { segments }),
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

function parseSegment(input: unknown, at: string): Segment {
  const s = record(input, at)
  only(s, ['id', 'label', 'vlan', 'prefix'], at)
  return {
    id: string(s.id, `${at}.id`),
    label: optionalString(s.label, `${at}.label`),
    vlan: optionalVlan(s.vlan, `${at}.vlan`),
    prefix: optionalString(s.prefix, `${at}.prefix`),
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
      'vendor',
      'model',
      'address',
      'description',
      'group',
      'assumed',
      'members',
    ],
    at,
  )
  if (n.model !== undefined && n.vendor === undefined)
    throw new ModelError(`${at}.model: requires vendor`)
  const members =
    n.members === undefined
      ? undefined
      : list(n.members, `${at}.members`).map((m, i) => parseMember(m, `${at}.members[${i}]`))
  if (members && members.length < 2) throw new ModelError(`${at}.members: expected at least 2`)
  if (members && n.address !== undefined)
    throw new ModelError(`${at}.address: an aggregate node keeps addresses on its members`)
  return {
    id: string(n.id, `${at}.id`),
    label: optionalString(n.label, `${at}.label`),
    type: optionalString(n.type, `${at}.type`),
    vendor: optionalString(n.vendor, `${at}.vendor`),
    model: optionalString(n.model, `${at}.model`),
    address: optionalString(n.address, `${at}.address`),
    description: optionalString(n.description, `${at}.description`),
    group: optionalString(n.group, `${at}.group`),
    assumed: optionalTrue(n.assumed, `${at}.assumed`),
    members,
  }
}

function parseMember(input: unknown, at: string): Member {
  const m = record(input, at)
  only(m, ['label', 'address'], at)
  return {
    label: optionalString(m.label, `${at}.label`),
    address: optionalString(m.address, `${at}.address`),
  }
}

function parseLink(input: unknown, at: string): Link {
  const l = record(input, at)
  only(l, ['endpoints', 'speed', 'segments', 'description', 'assumed'], at)
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
    assumed: optionalTrue(l.assumed, `${at}.assumed`),
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
  only(e, ['node', 'port', 'address'], at)
  return {
    node: string(e.node, `${at}.node`),
    port: optionalString(e.port, `${at}.port`),
    address: optionalString(e.address, `${at}.address`),
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
