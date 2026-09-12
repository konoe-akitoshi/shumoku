type RecordValue = Record<string, unknown>

const input = (await Bun.file('tmp-test6-graph.json').json()) as RecordValue
const nodes = input.nodes as RecordValue[]
const links = input.links as RecordValue[]

const endpointNode = (endpoint: unknown): string => {
  if (typeof endpoint === 'string') return endpoint
  return String((endpoint as RecordValue).node)
}

const nodeById = new Map(nodes.map((node) => [String(node.id), node]))
const labelOf = (id: string) => String(nodeById.get(id)?.label ?? id)
const locationOf = (id: string) => {
  const metadata = nodeById.get(id)?.metadata as RecordValue | undefined
  return String(metadata?.location ?? 'Unassigned')
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const roleOfNode = (node: RecordValue): string => {
  const label = String(node.label ?? '')
  const metadata = (node.metadata ?? {}) as RecordValue
  const location = String(metadata.location ?? '')
  if (label.includes('lastresort')) return 'fallback'
  if (/^NOC#N-[12]$/.test(location)) return 'border'
  if (location === 'NOC#N-3') return 'core'
  if (/^NOC#N-/.test(location)) return 'aggregation'
  if (/^NOC#D-/.test(location)) return 'datacenter'
  if (/^NOC#S-/.test(location)) return 'service'
  if (location.startsWith('Pod#') || location === 'Stage') return 'access'
  return 'unknown'
}

const locations = [...new Set(nodes.map((node) => locationOf(String(node.id))))].sort()
const locationSubgraph = new Map(
  locations.map((location) => [location, `test:location:${slug(location)}`]),
)

const completedNodes = nodes.map((node) => {
  const id = String(node.id)
  const metadata = (node.metadata ?? {}) as RecordValue
  return {
    ...node,
    parent: locationSubgraph.get(locationOf(id)),
    metadata: {
      ...metadata,
      topologyRole: roleOfNode(node),
      completion: {
        source: 'test-fixture-enrichment',
        inferredFields: ['parent', 'topologyRole'],
      },
    },
  }
})

const pairKey = (a: string, b: string) => [a, b].sort().join('|')
const pairCounts = new Map<string, number>()
for (const link of links) {
  const key = pairKey(endpointNode(link.from), endpointNode(link.to))
  pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
}

const stem = (label: string) => label.replace(/-\d+(?=\.)/, '')
const roleOfLink = (link: RecordValue): string => {
  const from = endpointNode(link.from)
  const to = endpointNode(link.to)
  const fromLabel = labelOf(from)
  const toLabel = labelOf(to)
  const metadata = (link.metadata ?? {}) as RecordValue
  if (fromLabel.includes('lastresort') || toLabel.includes('lastresort')) return 'fallback'
  if (metadata.discoveredVia === 'zabbix-parent-tag') return 'structural'
  if (stem(fromLabel) === stem(toLabel) && fromLabel !== toLabel) return 'ha-interconnect'
  if ((pairCounts.get(pairKey(from, to)) ?? 0) > 1) return 'parallel'
  if (locationOf(from) === locationOf(to)) return 'peer'
  return 'structural'
}

const completedLinks = links.map((link, index) => {
  const from = endpointNode(link.from)
  const to = endpointNode(link.to)
  const metadata = (link.metadata ?? {}) as RecordValue
  const inferredFields: string[] = ['topologyRole']
  if (!link.id) inferredFields.push('id')
  if (!link.label) inferredFields.push('label')
  const logicalOnly = metadata.discoveredVia === 'zabbix-parent-tag'
  return {
    ...link,
    id: link.id ?? `test:link:${String(index + 1).padStart(3, '0')}`,
    label: link.label ?? `${labelOf(from)} ↔ ${labelOf(to)}`,
    metadata: {
      ...metadata,
      topologyRole: roleOfLink(link),
      logicalOnly,
      completion: {
        source: 'test-fixture-enrichment',
        inferredFields,
        ...(logicalOnly
          ? { note: 'No physical speed inferred for Zabbix parent-tag relation' }
          : {}),
      },
    },
  }
})

const completed = {
  ...input,
  name: `${String(input.name)}-completed`,
  nodes: completedNodes,
  links: completedLinks,
  subgraphs: locations.map((location) => ({
    id: locationSubgraph.get(location),
    label: location,
    metadata: {
      topologyRole: 'location',
      completion: { source: 'test-fixture-enrichment', inferred: true },
    },
  })),
  metadata: {
    ...((input.metadata ?? {}) as RecordValue),
    testFixture: true,
    completion: {
      source: 'tmp-test6-graph.json',
      generatedAt: new Date().toISOString(),
      policy: 'Preserve observed facts; mark inferred topology semantics explicitly',
    },
  },
}

await Bun.write('tmp-test6-graph-complete.json', `${JSON.stringify(completed, null, 2)}\n`)
console.log('wrote tmp-test6-graph-complete.json')
