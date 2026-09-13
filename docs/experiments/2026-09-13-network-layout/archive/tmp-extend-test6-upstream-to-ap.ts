const source = await Bun.file('tmp-test6-graph-complete.json').json()
const nodes = structuredClone(source.nodes)
const links = structuredClone(source.links)
const subgraphs = structuredClone(source.subgraphs)
const byId = new Map(nodes.map((node) => [node.id, node]))

function addNode(node) {
  nodes.push(node)
  byId.set(node.id, node)
}

function addPort(nodeId, portId, speed) {
  const node = byId.get(nodeId)
  if (!node) throw new Error(`Unknown node ${nodeId}`)
  node.ports.push({
    id: portId,
    label: portId.split(':').at(-1),
    speed,
    connectors: [],
    provenance: { source: 'test-fixture', state: 'confirmed' },
  })
}

function connect(id, fromNode, toNode, speed, rateBps, role) {
  const fromPort = `${fromNode}:test:${id}:from`
  const toPort = `${toNode}:test:${id}:to`
  addPort(fromNode, fromPort, speed)
  addPort(toNode, toPort, speed)
  links.push({
    id,
    label: `${byId.get(fromNode).label} ↔ ${byId.get(toNode).label}`,
    from: { node: fromNode, port: fromPort },
    to: { node: toNode, port: toPort },
    rateBps,
    metadata: { speedBps: rateBps, topologyRole: role, testFixture: true, inferred: true },
    provenance: { source: 'test-fixture', state: 'confirmed' },
  })
}

subgraphs.push({
  id: 'test:zone:wan',
  label: 'WAN / Transit',
  metadata: { topologyRole: 'wan', testFixture: true },
})

const physicalAreas = [
  ['hall-east', 'Exhibition Hall East', 4],
  ['hall-west', 'Exhibition Hall West', 4],
  ['conference', 'Conference Floor', 4],
  ['lobby', 'Lobby / Entrance', 4],
  ['meeting', 'Meeting Rooms', 4],
  ['auditorium', 'Auditorium', 3],
  ['operations', 'Operations Floor', 3],
]
for (const [areaId, label] of physicalAreas) {
  subgraphs.push({
    id: `test:area:${areaId}`,
    label,
    metadata: { topologyRole: 'physical-area', physicalLocation: label, testFixture: true },
  })
}

for (const [id, label, role] of [
  ['test:internet', 'Internet', 'internet'],
  ['test:isp-a', 'Transit ISP A', 'provider'],
  ['test:isp-b', 'Transit ISP B', 'provider'],
]) {
  addNode({
    id,
    label,
    parent: 'test:zone:wan',
    shape: 'cloud',
    spec: { kind: 'hardware', type: 'cloud', vendor: 'test-fixture' },
    metadata: { topologyRole: role, location: 'WAN', testFixture: true, synthetic: true },
    ports: [],
    provenance: { source: 'test-fixture', state: 'confirmed' },
  })
}

const idOf = (label) => nodes.find((node) => node.label === label)?.id
const borderA = idOf('cisco8712.noc')
const borderB = idOf('mx301.noc')
const borderC = idOf('ptx10002-60mr.noc')
if (!borderA || !borderB || !borderC) throw new Error('Expected border nodes are missing')

connect('test:wan:001', 'test:internet', 'test:isp-a', '800g', 800_000_000_000, 'structural')
connect('test:wan:002', 'test:internet', 'test:isp-b', '800g', 800_000_000_000, 'structural')
connect('test:wan:003', 'test:isp-a', borderA, '400g', 400_000_000_000, 'structural')
connect('test:wan:004', 'test:isp-a', borderB, '400g', 400_000_000_000, 'redundant')
connect('test:wan:005', 'test:isp-b', borderB, '400g', 400_000_000_000, 'structural')
connect('test:wan:006', 'test:isp-b', borderC, '400g', 400_000_000_000, 'redundant')

const accessNodes = nodes.filter(
  (node) => node.metadata?.topologyRole === 'access' && /\.pod/i.test(node.label),
)
let apCount = 0
const poeIds = []
for (const [areaIndex, [areaId, physicalLocation, apTotal]] of physicalAreas.entries()) {
  const poeId = `test:poe:${areaId}`
  poeIds.push(poeId)
  addNode({
    id: poeId,
    label: `poe-${areaId}`,
    parent: `test:area:${areaId}`,
    shape: 'rounded',
    spec: { kind: 'hardware', type: 'l2-switch', vendor: 'test-vendor', model: '48-port-poe++' },
    metadata: {
      topologyRole: 'floor-poe-switch',
      physicalLocation,
      location: physicalLocation,
      testFixture: true,
      synthetic: true,
    },
    ports: [],
    provenance: { source: 'test-fixture', state: 'confirmed' },
  })
  const rackA = accessNodes[(areaIndex * 2) % accessNodes.length]
  const rackB = accessNodes[(areaIndex * 2 + 1) % accessNodes.length]
  connect(`test:poe-uplink:${areaId}:a`, rackA.id, poeId, '100g', 100_000_000_000, 'structural')
  connect(`test:poe-uplink:${areaId}:b`, rackB.id, poeId, '100g', 100_000_000_000, 'redundant')
  for (const index of Array.from({ length: apTotal }, (_, item) => item + 1)) {
    apCount += 1
    const apId = `test:ap:${String(apCount).padStart(2, '0')}`
    addNode({
      id: apId,
      label: `${areaId}-ap-${index}`,
      parent: `test:area:${areaId}`,
      shape: 'rounded',
      spec: { kind: 'hardware', type: 'access-point', vendor: 'test-vendor', model: 'wifi-7-ap' },
      metadata: {
        topologyRole: 'wireless-ap',
        physicalLocation,
        location: physicalLocation,
        upstreamPoeNode: poeId,
        testFixture: true,
        synthetic: true,
      },
      ports: [],
      provenance: { source: 'test-fixture', state: 'confirmed' },
    })
    connect(
      `test:ap-link:${String(apCount).padStart(2, '0')}`,
      poeId,
      apId,
      '10g',
      10_000_000_000,
      'access',
    )
  }
}

// Floor PoE switches form a resilient ring, with extra cross-floor shortcuts.
for (const [index, poeId] of poeIds.entries()) {
  const next = poeIds[(index + 1) % poeIds.length]
  connect(`test:floor-ring:${index + 1}`, poeId, next, '25g', 25_000_000_000, 'floor-peer')
}
for (const [index, [from, to]] of [
  [poeIds[0], poeIds[3]],
  [poeIds[1], poeIds[5]],
  [poeIds[2], poeIds[6]],
].entries()) {
  connect(`test:floor-cross:${index + 1}`, from, to, '25g', 25_000_000_000, 'floor-peer')
}

const result = {
  ...source,
  name: 'test6-complete-upstream-to-ap',
  nodes,
  links,
  subgraphs,
  metadata: {
    ...source.metadata,
    testFixture: true,
    completion: {
      source: 'tmp-test6-graph-complete.json',
      policy:
        'Preserve every observed node and link; add WAN, rack-to-floor PoE, inter-floor, and AP fixtures',
      preservedObservedNodes: 53,
      preservedObservedLinks: 104,
      addedWanNodes: 3,
      addedWanLinks: 6,
      addedApNodes: apCount,
      addedApLinks: apCount,
      addedFloorPoeNodes: poeIds.length,
      addedRackToPoeLinks: poeIds.length * 2,
      addedInterFloorLinks: 10,
    },
  },
}

await Bun.write('tmp-test6-complete-upstream-to-ap.json', `${JSON.stringify(result, null, 2)}\n`)
console.log(`wrote ${nodes.length} nodes, ${links.length} links, ${apCount} APs`)
