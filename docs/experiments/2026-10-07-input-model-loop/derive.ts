import {
  addressList,
  type Link,
  type Network,
  type Node,
  type NodeEnd,
  type Style,
  type ViewMatch,
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
      subgraphs: network.groups.map((g) => ({
        id: g.id,
        ...(g.label && { label: g.label }),
        ...(g.parent && { parent: g.parent }),
      })),
    }),
    nodes: network.nodes.map((n) => {
      const label = legacyLabel(n, addressesOf(n.id))
      const { icon, ...style } = drawn((m) => nodeMatches(m, n))
      return {
        id: n.id,
        ...(label && { label }),
        ...(n.type && { type: n.type }),
        ...productFields(n.product),
        ...(n.group && { parent: n.group }),
        ...(icon && { icon }),
        ...legacyStyle(style),
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

  /** The view's rules in order; a later rule's fields win. */
  function drawn(selects: (match: ViewMatch) => boolean): Style {
    const style: Style = {}
    for (const { match, ...fields } of network.view ?? []) {
      // A rule only sets what it names; an unset field must not clear an earlier rule's.
      if (selects(match))
        Object.assign(
          style,
          Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
        )
    }
    return style
  }

  function nodeMatches(m: ViewMatch, n: Node): boolean {
    if (m.segment || m.cable || m.virtual || m.between) return false
    return (
      (!m.node || m.node === n.id) &&
      (!m.type || m.type === n.type) &&
      (!m.group || m.group === n.group)
    )
  }

  function linkMatches(m: ViewMatch, link: Link): boolean {
    if (m.type || m.group) return false
    const ends = link.endpoints.flatMap((e) => ('node' in e ? [e.node] : []))
    return (
      (!m.node || ends.includes(m.node)) &&
      (!m.segment || (link.segments ?? []).includes(m.segment)) &&
      (!m.cable || m.cable === link.cable) &&
      (!m.virtual || link.virtual === true) &&
      (!m.between || m.between.every((n) => ends.includes(n)))
    )
  }

  function legacyLink(link: Link) {
    const {
      endpoints: [a, b],
      segments = [],
      virtual,
    } = link
    if (!('node' in a) || !('node' in b)) return []
    const style = drawn((m) => linkMatches(m, link))
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
      ...((virtual || style.dashed) && { type: 'dashed' }),
      ...legacyStyle(style),
    }
  }
}

function legacyStyle({ stroke, fill, dashed }: Style): Record<string, unknown> {
  const style = {
    ...(stroke && { stroke }),
    ...(fill && { fill }),
    ...(dashed && { strokeDasharray: '6 4' }),
  }
  return Object.keys(style).length > 0 ? { style } : {}
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
