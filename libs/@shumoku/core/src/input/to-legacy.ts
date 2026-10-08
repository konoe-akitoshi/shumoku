import type { YamlLink, YamlLinkEndpoint, YamlNetworkInput, YamlNode } from '../parser/parser.js'
import { addressList, flattenGroups } from './parse.js'
import type { Link, Network, Node, NodeEnd, NodeId } from './schema.js'

/**
 * Builds the older YAML shape from the input, so the existing parser, layout and renderers can
 * draw it until drawing reads the input itself. The older shape holds less, so some facts show
 * only as text or not at all: a link to a segment or a routing domain is not drawn, and a node's
 * facts join its label.
 */
export function toLegacyInput(network: Network): YamlNetworkInput {
  const segmentOf = new Map(network.segments?.map((s) => [s.id, s]))
  // The layout pairs up the two ends of a link inside one redundancy set.
  const paired = (a: NodeId, b: NodeId) =>
    network.redundancy?.some((r) => r.nodes.includes(a) && r.nodes.includes(b)) ?? false
  const addressesOf = (node: NodeId) =>
    network.segments?.flatMap((s) => addressList(s.addresses?.[node])) ?? []

  return {
    ...(network.name && { name: network.name }),
    ...(network.description && { description: network.description }),
    ...(network.groups && {
      subgraphs: flattenGroups(network.groups).map(({ group, parent }) => ({
        id: group.id,
        ...(group.label && { label: group.label }),
        ...(parent && { parent }),
      })),
    }),
    nodes: network.nodes.map(
      (n): YamlNode => ({
        id: n.id,
        ...labelled(n, addressesOf(n.id)),
        ...(n.type && { type: n.type }),
        ...productFields(n.product),
        ...(n.group && { parent: n.group }),
      }),
    ),
    // The older shape has no link to a segment; such a link shows only as the VLAN of a VM's host line.
    links: [...network.links.flatMap(legacyLink), ...network.nodes.flatMap(hostLink)],
  }

  // The older shape has no "runs on", so a VM on a known host shows as a dashed line to it,
  // carrying the VLANs the VM is in. A VM on a redundancy set has no single host to draw to.
  function hostLink(node: Node): YamlLink[] {
    const { host } = node
    if (!host || !network.nodes.some((n) => n.id === host)) return []
    const vlan = (network.segments ?? []).flatMap((s) =>
      (s.addresses?.[node.id] || attachedTo(node.id, s.id)) && s.vlan ? [s.vlan] : [],
    )
    return [{ from: host, to: node.id, ...(vlan.length > 0 && { vlan }), type: 'dashed' }]
  }

  function attachedTo(node: string, segment: string): boolean {
    return network.links.some(
      ({ endpoints }) =>
        endpoints.some((e) => 'node' in e && e.node === node) &&
        endpoints.some((e) => 'segment' in e && e.segment === segment),
    )
  }

  function legacyLink({ endpoints: [a, b], segments = [], virtual }: Link): YamlLink[] {
    if (!('node' in a) || !('node' in b)) return []
    const carried = segments.flatMap((s) => segmentOf.get(s) ?? [])
    const vlan = carried.flatMap((s) => s.vlan ?? [])
    // The older shape has one ip per end, so only one segment and one address can show.
    const addresses = carried.length === 1 ? carried[0]?.addresses : undefined
    const ip = (node: NodeId) => {
      const found = addressList(addresses?.[node])
      return found.length === 1 ? found[0] : undefined
    }
    return [
      {
        from: legacyEnd(a, ip(a.node)),
        to: legacyEnd(b, ip(b.node)),
        ...(vlan.length > 0 && { vlan }),
        ...(paired(a.node, b.node) && { redundancy: 'ha' }),
        ...(virtual && { type: 'dashed' }),
      },
    ]
  }
}

/** The display composes the label from the name and the facts; the input keeps them apart. */
function labelled(node: Node, addresses: string[]): Pick<YamlNode, 'label'> {
  const facts = [
    node.product?.split('/').slice(1).join(' ') || undefined,
    node.software,
    node.address,
    ...addresses.map((a) => a.replace(/\/\d+$/, '')),
    node.members?.join(' / '),
    node.description,
  ].filter((f) => f !== undefined)
  if (facts.length === 0) return node.label ? { label: node.label } : {}
  return { label: [`<b>${node.label ?? node.id}</b>`, ...facts] }
}

function legacyEnd(end: NodeEnd, ip: string | undefined): string | YamlLinkEndpoint {
  if (!end.port && !ip) return end.node
  return { node: end.node, ...(end.port && { port: end.port }), ...(ip && { ip }) }
}

/** The older shape keys icons by vendor and model; a product path carries both as its ends. */
function productFields(product: string | undefined): Pick<YamlNode, 'vendor' | 'model'> {
  const [vendor, ...rest] = product?.split('/') ?? []
  const model = rest.at(-1)
  return { ...(vendor && vendor !== '?' && { vendor }), ...(model && { model }) }
}
