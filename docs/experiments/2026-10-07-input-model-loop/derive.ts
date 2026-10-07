import type { Endpoint, Network, Node } from './model'

/** Builds the existing YAML input shape, so the current parser and renderer can consume the model. */
export function toLegacyYaml(network: Network): Record<string, unknown> {
  const segmentOf = new Map(network.segments?.map((s) => [s.id, s]))
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
    links: network.links.map(({ endpoints: [a, b], segments = [] }) => {
      const carried = segments.flatMap((s) => segmentOf.get(s) ?? [])
      const vlan = carried.flatMap((s) => s.vlan ?? [])
      // The old shape has one ip per endpoint, so only a link with a single segment can show it.
      const addresses = carried.length === 1 ? carried[0]?.addresses : undefined
      return {
        from: legacyEnd(a, addresses?.[a.node]),
        to: legacyEnd(b, addresses?.[b.node]),
        ...(vlan.length > 0 && { vlan }),
      }
    }),
  }
}

/** The display composes the label from the name and the facts; the model stores them apart. */
function legacyLabel(node: Node): string | string[] | undefined {
  const members = node.members?.map((m) => m.label ?? m.address ?? '?').join(' / ')
  const facts = [node.model, node.address, members, node.description].filter((f) => f !== undefined)
  if (facts.length === 0) return node.label
  return [`<b>${node.label ?? node.id}</b>`, ...facts]
}

function legacyEnd(end: Endpoint, ip: string | undefined): string | Record<string, string> {
  if (!end.port && !ip) return end.node
  return { node: end.node, ...(end.port && { port: end.port }), ...(ip && { ip }) }
}
