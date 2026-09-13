type Device = {
  id: string
  label: string
  tier: string
  role: string
  type: string
  vendor?: string
  model?: string
  synthetic?: boolean
}

type Endpoint = { node: string; port: string }
type TestNode = Device & {
  parent: string
  shape: string
  spec: object
  metadata: object
  ports: object[]
}
type TestLink = {
  id: string
  label: string
  from: Endpoint
  to: Endpoint
  rateBps: number
  metadata: object
  provenance: object
}

const devices: Device[] = [
  {
    id: 'internet',
    label: 'Internet',
    tier: 'WAN',
    role: 'internet',
    type: 'cloud',
    synthetic: true,
  },
  {
    id: 'isp-a',
    label: 'Transit ISP A',
    tier: 'WAN',
    role: 'provider',
    type: 'cloud',
    synthetic: true,
  },
  {
    id: 'isp-b',
    label: 'Transit ISP B',
    tier: 'WAN',
    role: 'provider',
    type: 'cloud',
    synthetic: true,
  },
  {
    id: 'border-a',
    label: 'cisco8712.noc',
    tier: 'Border',
    role: 'border',
    type: 'router',
    vendor: 'cisco',
    model: 'cisco8712',
  },
  {
    id: 'border-b',
    label: 'mx301.noc',
    tier: 'Border',
    role: 'border',
    type: 'router',
    vendor: 'juniper',
    model: 'mx301',
  },
  {
    id: 'core-a',
    label: 'cisco8711-32fh.noc',
    tier: 'Core',
    role: 'core',
    type: 'router',
    vendor: 'cisco',
    model: 'cisco8711-32fh',
  },
  {
    id: 'core-b',
    label: 'ptx10002-36qdd.noc',
    tier: 'Core',
    role: 'core',
    type: 'router',
    vendor: 'juniper',
    model: 'ptx10002-36qdd',
  },
  {
    id: 'distribution-a',
    label: 's9610-36d.noc',
    tier: 'Distribution',
    role: 'distribution',
    type: 'l3-switch',
    model: 's9610-36d',
  },
  {
    id: 'distribution-b',
    label: 'fsax9004g.noc',
    tier: 'Distribution',
    role: 'distribution',
    type: 'l3-switch',
    model: 'fsax9004g',
  },
  {
    id: 'access-3y',
    label: 'ce6885.pod3y',
    tier: 'Access',
    role: 'access',
    type: 'l2-switch',
    model: 'ce6885',
  },
  {
    id: 'access-3u',
    label: 'ce6885.pod3u',
    tier: 'Access',
    role: 'access',
    type: 'l2-switch',
    model: 'ce6885',
  },
  {
    id: 'access-4',
    label: 'ex4400.pod4',
    tier: 'Access',
    role: 'access',
    type: 'l2-switch',
    vendor: 'juniper',
    model: 'ex4400',
  },
  {
    id: 'access-6y',
    label: 'cx8100.pod6y',
    tier: 'Access',
    role: 'access',
    type: 'l2-switch',
    model: 'cx8100',
  },
  {
    id: 'access-6u',
    label: 'cx8100.pod6u',
    tier: 'Access',
    role: 'access',
    type: 'l2-switch',
    model: 'cx8100',
  },
  {
    id: 'access-8y',
    label: 'ex4400.pod8y',
    tier: 'Access',
    role: 'access',
    type: 'l2-switch',
    vendor: 'juniper',
    model: 'ex4400',
  },
]

for (const pod of ['3Y', '3U', '4', '6Y', '6U', '8Y']) {
  for (const index of [1, 2]) {
    devices.push({
      id: `ap-${pod.toLowerCase()}-${index}`,
      label: `ap-${pod.toLowerCase()}-${index}`,
      tier: 'AP',
      role: 'wireless-ap',
      type: 'access-point',
      vendor: 'test-vendor',
      model: 'wifi-7-ap',
      synthetic: true,
    })
  }
}

const groupId = (tier: string) => `test:tier:${tier.toLowerCase()}`
const nodes = new Map<string, TestNode>()
for (const device of devices) {
  nodes.set(device.id, {
    ...device,
    parent: groupId(device.tier),
    shape: device.type === 'cloud' ? 'stadium' : 'rounded',
    spec: { kind: 'hardware', type: device.type, vendor: device.vendor, model: device.model },
    metadata: {
      topologyRole: device.role,
      tier: device.tier,
      location:
        device.tier === 'Access' || device.tier === 'AP'
          ? (device.label.match(/pod\d+[yu]?/)?.[0] ?? device.tier)
          : device.tier,
      testFixture: true,
      synthetic: device.synthetic ?? false,
    },
    ports: [],
  })
}

const links: TestLink[] = []
const portSequence = new Map<string, number>()
const nextPort = (nodeId: string, speed: string) => {
  const sequence = (portSequence.get(nodeId) ?? 0) + 1
  portSequence.set(nodeId, sequence)
  const id = `${nodeId}:port:${sequence}`
  const node = nodes.get(nodeId)
  if (!node) throw new Error(`Unknown node ${nodeId}`)
  node.ports.push({ id, label: `${speed}-${sequence}`, connectors: [], speed })
  return id
}

const speedLabel = (rateBps: number) => `${rateBps / 1_000_000_000}g`
const connect = (from: string, to: string, rateBps: number, role: string) => {
  const number = links.length + 1
  const speed = speedLabel(rateBps)
  links.push({
    id: `test:uplink:${String(number).padStart(3, '0')}`,
    label: `${nodes.get(from)?.label} ↔ ${nodes.get(to)?.label}`,
    from: { node: from, port: nextPort(from, speed) },
    to: { node: to, port: nextPort(to, speed) },
    rateBps,
    metadata: { topologyRole: role, testFixture: true, inferred: true },
    provenance: { source: 'test-fixture', state: 'confirmed' },
  })
}

connect('internet', 'isp-a', 800_000_000_000, 'structural')
connect('internet', 'isp-b', 800_000_000_000, 'structural')
connect('isp-a', 'border-a', 400_000_000_000, 'structural')
connect('isp-a', 'border-b', 400_000_000_000, 'redundant')
connect('isp-b', 'border-a', 400_000_000_000, 'redundant')
connect('isp-b', 'border-b', 400_000_000_000, 'structural')

for (const border of ['border-a', 'border-b']) {
  for (const core of ['core-a', 'core-b']) connect(border, core, 400_000_000_000, 'structural')
}
for (const core of ['core-a', 'core-b']) {
  for (const distribution of ['distribution-a', 'distribution-b'])
    connect(core, distribution, 100_000_000_000, 'structural')
}

const accessNodes = ['access-3y', 'access-3u', 'access-4', 'access-6y', 'access-6u', 'access-8y']
for (const access of accessNodes) {
  connect('distribution-a', access, 100_000_000_000, 'structural')
  connect('distribution-b', access, 100_000_000_000, 'redundant')
  const pod = access.replace('access-', '')
  connect(access, `ap-${pod}-1`, 10_000_000_000, 'access')
  connect(access, `ap-${pod}-2`, 10_000_000_000, 'access')
}

const tierOrder = ['WAN', 'Border', 'Core', 'Distribution', 'Access', 'AP']
const topology = {
  version: '1.0',
  name: 'test-upstream-to-ap',
  nodes: [...nodes.values()],
  links,
  subgraphs: tierOrder.map((tier, index) => ({
    id: groupId(tier),
    label: tier,
    metadata: { topologyRole: 'tier', tierOrder: index, testFixture: true },
  })),
  settings: { direction: 'TB' },
  metadata: {
    testFixture: true,
    purpose:
      'Deterministic complete topology from Internet transit through redundant campus fabric to wireless APs',
    assumptions: [
      'ISP, Internet, and AP nodes are synthetic test fixtures',
      'Selected NOC and access device names are reused from tmp-test6-graph.json',
      'All physical links, port assignments, roles, and speeds in this fixture are explicit',
    ],
  },
}

await Bun.write('tmp-test6-upstream-to-ap.json', `${JSON.stringify(topology, null, 2)}\n`)
console.log(`wrote tmp-test6-upstream-to-ap.json: ${nodes.size} nodes, ${links.length} links`)
