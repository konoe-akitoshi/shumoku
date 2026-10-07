import type { Endpoint, Network, Node } from './model'

/** Builds the existing YAML input shape, so the current parser and renderer can consume the model. */
export function toLegacyYaml(network: Network): Record<string, unknown> {
  const segmentOf = new Map(network.segments?.map((s) => [s.id, s]))
  // The layout pairs up the two ends of a link inside one redundancy set.
  const paired = (a: string, b: string) =>
    network.redundancy?.some((r) => r.nodes.includes(a) && r.nodes.includes(b)) ?? false
  const addressesOf = (node: string) =>
    network.segments?.flatMap((s) => s.addresses?.[node] ?? []) ?? []
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
      const label = legacyLabel(n, addressesOf(n.id))
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
      // The old shape has one ip per endpoint, so only one segment and one address can show.
      const addresses = carried.length === 1 ? carried[0]?.addresses : undefined
      const ip = (node: string) => {
        const found = addresses?.[node]
        return found?.length === 1 ? found[0] : undefined
      }
      return {
        from: legacyEnd(a, ip(a.node)),
        to: legacyEnd(b, ip(b.node)),
        ...(vlan.length > 0 && { vlan }),
        ...(paired(a.node, b.node) && { redundancy: 'ha' }),
      }
    }),
  }
}

/** The display composes the label from the name and the facts; the model stores them apart. */
function legacyLabel(node: Node, addresses: string[]): string | string[] | undefined {
  const facts = [
    node.model,
    node.address,
    ...addresses.map((a) => a.replace(/\/\d+$/, '')),
    node.members?.join(' / '),
    node.description,
  ].filter((f) => f !== undefined)
  if (facts.length === 0) return node.label
  return [`<b>${node.label ?? node.id}</b>`, ...facts]
}

function legacyEnd(end: Endpoint, ip: string | undefined): string | Record<string, string> {
  if (!end.port && !ip) return end.node
  return { node: end.node, ...(end.port && { port: end.port }), ...(ip && { ip }) }
}
