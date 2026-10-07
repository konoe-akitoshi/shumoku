export interface Network {
  name?: string
  nodes: Node[]
  links: Link[]
}

export interface Node {
  id: string
  label?: string
  type?: string
}

/** Undirected: the two endpoints have no order. */
export interface Link {
  endpoints: [Endpoint, Endpoint]
}

/** A port is optional because many sources know only which nodes are connected. */
export interface Endpoint {
  node: string
  port?: string
}

export class ModelError extends Error {}

export function parseNetwork(input: unknown): Network {
  const root = record(input, 'network')
  only(root, ['name', 'nodes', 'links'], 'network')
  const nodes = list(root.nodes, 'nodes').map((n, i) => parseNode(n, `nodes[${i}]`))
  const links = list(root.links, 'links').map((l, i) => parseLink(l, `links[${i}]`))

  const ids = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) throw new ModelError(`duplicate node id: ${node.id}`)
    ids.add(node.id)
  }
  for (const [i, link] of links.entries()) {
    for (const end of link.endpoints) {
      if (!ids.has(end.node)) throw new ModelError(`links[${i}]: unknown node ${end.node}`)
    }
  }
  return { name: optionalString(root.name, 'name'), nodes, links }
}

function parseNode(input: unknown, at: string): Node {
  const n = record(input, at)
  only(n, ['id', 'label', 'type'], at)
  return {
    id: string(n.id, `${at}.id`),
    label: optionalString(n.label, `${at}.label`),
    type: optionalString(n.type, `${at}.type`),
  }
}

function parseLink(input: unknown, at: string): Link {
  const l = record(input, at)
  only(l, ['endpoints'], at)
  const ends = list(l.endpoints, `${at}.endpoints`)
  if (ends.length !== 2) throw new ModelError(`${at}.endpoints: expected exactly 2`)
  const [a, b] = ends.map((e, i) => parseEndpoint(e, `${at}.endpoints[${i}]`))
  if (!a || !b) throw new ModelError(`${at}.endpoints: expected exactly 2`)
  return { endpoints: [a, b] }
}

function parseEndpoint(input: unknown, at: string): Endpoint {
  const e = record(input, at)
  only(e, ['node', 'port'], at)
  return { node: string(e.node, `${at}.node`), port: optionalString(e.port, `${at}.port`) }
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

function string(v: unknown, at: string): string {
  if (typeof v !== 'string' || v === '') throw new ModelError(`${at}: expected non-empty string`)
  return v
}

function optionalString(v: unknown, at: string): string | undefined {
  return v === undefined ? undefined : string(v, at)
}

function only(o: Record<string, unknown>, keys: string[], at: string) {
  for (const k of Object.keys(o)) {
    if (!keys.includes(k)) throw new ModelError(`${at}: unknown field ${k}`)
  }
}
