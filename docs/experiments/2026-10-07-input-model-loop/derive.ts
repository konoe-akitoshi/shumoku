import {
  addressList,
  flattenGroups,
  type Link,
  type Network,
  type Node,
  type NodeEnd,
} from './model'

/** Builds the existing YAML input shape, so the current parser and renderer can consume the model. */
export function toLegacyYaml(network: Network): Record<string, unknown> {
  const segmentOf = new Map(network.segments?.map((s) => [s.id, s]))
  // The layout pairs up the two ends of a link inside one redundancy set.
  const paired = (a: string, b: string) =>
    network.redundancy?.some((r) => r.nodes.includes(a) && r.nodes.includes(b)) ?? false
  const addressesOf = (node: string) =>
    network.segments?.flatMap((s) => addressList(s.addresses?.[node])) ?? []
  const legacy = {
    ...(network.name && { name: network.name }),
    ...(network.description && { description: network.description }),
    ...(network.groups && {
      subgraphs: flattenGroups(network.groups).map(({ group, parent }) => ({
        id: group.id,
        ...(group.label && { label: group.label }),
        ...(parent && { parent }),
      })),
    }),
    nodes: network.nodes.map((n) => {
      const label = legacyLabel(n, addressesOf(n.id))
      return {
        id: n.id,
        ...(label && { label }),
        ...(n.type && { type: n.type }),
        ...productFields(n.product),
        ...(n.group && { parent: n.group }),
      }
    }),
    // The old shape has no link to a segment; such a link shows only as the VLAN of a VM's host line.
    links: [...network.links.flatMap(legacyLink), ...network.nodes.flatMap(hostLink)],
  }
  return legacy

  // The old shape has no "runs on", so a VM on a known host shows as a dashed line to it,
  // carrying the VLANs the VM is in. A VM on a cluster has no single host to draw to.
  function hostLink(node: Node): Record<string, unknown>[] {
    if (!node.host || !network.nodes.some((n) => n.id === node.host)) return []
    const vlan = (network.segments ?? []).flatMap((s) =>
      (s.addresses?.[node.id] || attachedTo(node.id, s.id)) && s.vlan ? [s.vlan] : [],
    )
    return [{ from: node.host, to: node.id, ...(vlan.length > 0 && { vlan }), type: 'dashed' }]
  }

  function attachedTo(node: string, segment: string): boolean {
    return network.links.some(
      ({ endpoints }) =>
        endpoints.some((e) => 'node' in e && e.node === node) &&
        endpoints.some((e) => 'segment' in e && e.segment === segment),
    )
  }

  function legacyLink({ endpoints: [a, b], segments = [], virtual }: Link) {
    if (!('node' in a) || !('node' in b)) return []
    const carried = segments.flatMap((s) => segmentOf.get(s) ?? [])
    const vlan = carried.flatMap((s) => s.vlan ?? [])
    // The old shape has one ip per endpoint, so only one segment and one address can show.
    const addresses = carried.length === 1 ? carried[0]?.addresses : undefined
    const ip = (node: string) => {
      const found = addressList(addresses?.[node])
      return found?.length === 1 ? found[0] : undefined
    }
    return {
      from: legacyEnd(a, ip(a.node)),
      to: legacyEnd(b, ip(b.node)),
      ...(vlan.length > 0 && { vlan }),
      ...(paired(a.node, b.node) && { redundancy: 'ha' }),
      ...(virtual && { type: 'dashed' }),
    }
  }
}

/** The display composes the label from the name and the facts; the model stores them apart. */
function legacyLabel(node: Node, addresses: string[]): string | string[] | undefined {
  const facts = [
    node.product?.split('/').slice(1).join(' ') || undefined,
    node.software,
    node.address,
    ...addresses.map((a) => a.replace(/\/\d+$/, '')),
    node.members?.join(' / '),
    node.description,
  ].filter((f) => f !== undefined)
  if (facts.length === 0) return node.label
  return [`<b>${node.label ?? node.id}</b>`, ...facts]
}

function legacyEnd(end: NodeEnd, ip: string | undefined): string | Record<string, string> {
  if (!end.port && !ip) return end.node
  return { node: end.node, ...(end.port && { port: end.port }), ...(ip && { ip }) }
}

/** The old shape keys icons by vendor and model; a product path carries both as its ends. */
function productFields(product: string | undefined): Record<string, string> {
  const [vendor, ...rest] = product?.split('/') ?? []
  const model = rest.at(-1)
  return { ...(vendor && vendor !== '?' && { vendor }), ...(model && { model }) }
}
