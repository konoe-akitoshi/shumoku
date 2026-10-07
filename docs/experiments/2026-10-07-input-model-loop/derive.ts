import type { Endpoint, Network, Node } from './model'

/** Builds the existing YAML input shape, so the current parser and renderer can consume the model. */
export function toLegacyYaml(network: Network): Record<string, unknown> {
  const vlanOf = new Map(network.segments?.map((s) => [s.id, s.vlan]))
  return {
    ...(network.name && { name: network.name }),
    ...(network.description && { description: network.description }),
    ...(network.groups && {
      subgraphs: network.groups.map((g) => ({
        id: g.id,
        ...(g.label && { label: g.label }),
        ...(g.parent && { parent: g.parent }),
      })),
    }),
    nodes: network.nodes.map((n) => {
      const label = legacyLabel(n)
      return {
        id: n.id,
        ...(label && { label }),
        ...(n.type && { type: n.type }),
        ...(n.vendor && { vendor: n.vendor }),
        ...(n.model && { model: n.model }),
        ...(n.group && { parent: n.group }),
      }
    }),
    links: network.links.map(({ endpoints: [a, b], segments }) => {
      const vlan = segments?.flatMap((s) => vlanOf.get(s) ?? [])
      return { from: legacyEnd(a), to: legacyEnd(b), ...(vlan?.length && { vlan }) }
    }),
  }
}

/** The display composes the label from the name and the facts; the model stores them apart. */
function legacyLabel(node: Node): string | string[] | undefined {
  const facts = [node.model, node.address, node.description].filter((f) => f !== undefined)
  if (facts.length === 0) return node.label
  return [`<b>${node.label ?? node.id}</b>`, ...facts]
}

function legacyEnd(end: Endpoint): string | Record<string, string> {
  if (!end.port && !end.address) return end.node
  return {
    node: end.node,
    ...(end.port && { port: end.port }),
    ...(end.address && { ip: end.address }),
  }
}
