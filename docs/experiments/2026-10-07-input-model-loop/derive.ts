import type { Endpoint, Network } from './model'

/** Builds the existing YAML input shape, so the current parser and renderer can consume the model. */
export function toLegacyYaml(network: Network): Record<string, unknown> {
  return {
    ...(network.name && { name: network.name }),
    nodes: network.nodes.map((n) => ({
      id: n.id,
      ...(n.label && { label: n.label }),
      ...(n.type && { type: n.type }),
    })),
    links: network.links.map(({ endpoints: [a, b] }) => ({ from: legacyEnd(a), to: legacyEnd(b) })),
  }
}

function legacyEnd(end: Endpoint): string | { node: string; port: string } {
  return end.port ? { node: end.node, port: end.port } : end.node
}
