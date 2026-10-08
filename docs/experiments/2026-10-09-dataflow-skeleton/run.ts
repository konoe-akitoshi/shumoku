// Walking skeleton: one made-up input through every stage. Not committed.
import yaml from 'js-yaml'
import { computeNetworkLayout, linkSpeedBps } from '../layout/index.js'
import { resolveTierFromSpec } from '../layout/role-tiers.js'
import type { NetworkGraph } from '../models/types.js'
import { resolve } from '../observation/resolve.js'
import { YamlParser } from '../parser/parser.js'
import { parseNetworkInput, toLegacyInput } from './index.js'

const source = `
groups:
  - id: dc
    groups: [{ id: rack-a }]
segments:
  - { id: mgmt, vlan: 10, prefix: 10.0.10.0/24, addresses: { core-1: 10.0.10.1, core-2: 10.0.10.2, edge: 10.0.10.254 } }
redundancy:
  - { id: core-pair, nodes: [core-1, core-2] }
nodes:
  - { id: edge, type: router, product: juniper/mx204, group: dc }
  - { id: core-1, type: l3-switch, group: rack-a }
  - { id: core-2, type: l3-switch, group: rack-a }
  - { id: acc-1, type: switch, group: rack-a }
links:
  - { endpoints: [{ node: edge, port: xe-0/0/0 }, { node: core-1, port: et-0/0/48 }], speed: 100G, segments: [mgmt] }
  - { endpoints: [{ node: edge, port: xe-0/0/1 }, { node: core-2, port: et-0/0/48 }], speed: 100G }
  - { endpoints: [{ node: core-1, port: et-0/0/0 }, { node: core-2, port: et-0/0/0 }], speed: 100G }
  - { endpoints: [{ node: core-1, port: xe-0/0/1 }, { node: acc-1, port: te1 }], speed: 10G }
`
const log = (stage: string, ...rest: unknown[]) => console.log(`[${stage}]`, ...rest)

// Stage 1: input -> source NetworkGraph (today: through the older YAML shape)
const read = parseNetworkInput(source)
if (!read.ok) throw new Error(JSON.stringify(read.issues))
const authoredGraph = new YamlParser().parse(yaml.dump(toLegacyInput(read.network))).graph
log('1 source', 'nodes', authoredGraph.nodes.length, 'links', authoredGraph.links.length)
for (const l of authoredGraph.links)
  log(
    '1 link',
    `${l.from.node}-${l.to.node}`,
    'rateBps',
    l.rateBps,
    'speed seen by layout',
    linkSpeedBps(l),
    'redundancy',
    l.redundancy,
    'vlan',
    l.vlan,
  )
for (const n of authoredGraph.nodes)
  log(
    '1 node',
    n.id,
    'spec',
    JSON.stringify(n.spec),
    'tier',
    JSON.stringify(resolveTierFromSpec(n.spec)),
    'identity',
    JSON.stringify(n.identity),
    'parent',
    n.parent,
  )

// A discovered source that sees the same devices (Zabbix-like: own ids, identity, LLDP links)
const discovered: NetworkGraph = {
  version: '1',
  nodes: [
    ['z1', 'edge', '10.0.10.254'],
    ['z2', 'core-1', '10.0.10.1'],
    ['z3', 'core-2', '10.0.10.2'],
    ['z4', 'acc-1', '10.0.10.11'],
    ['z5', 'srv-9', '10.0.10.90'],
  ].map(([id, name, ip]) => ({
    id: id as string,
    label: name as string,
    identity: { sysName: name, mgmtIp: ip },
  })),
  links: [
    { id: 'zl1', from: { node: 'z1', port: 'xe-0/0/0' }, to: { node: 'z2', port: 'et-0/0/48' } },
    { id: 'zl2', from: { node: 'z4', port: 'ge1' }, to: { node: 'z5', port: 'eth0' } },
  ],
}

// Stage 2: server resolve, hand-written graph as a Manual source and as the project overlay
const empty: NetworkGraph = { version: '1', nodes: [], links: [] }
const asSource = (graph: NetworkGraph, sourceId: string, priority: number) => ({
  sourceId,
  priority,
  capturedAt: 1,
  status: 'ok' as const,
  graph,
})
const viaManual = resolve(empty, [
  asSource(authoredGraph, 'manual', 100),
  asSource(discovered, 'zabbix', 50),
])
log(
  '2 manual+zabbix',
  'nodes',
  viaManual.nodes.length,
  viaManual.nodes.map((n) => n.label).join(' '),
  'links',
  viaManual.links.length,
)
const viaOverlay = resolve(authoredGraph, [asSource(discovered, 'zabbix', 50)])
log(
  '2 overlay+zabbix',
  'nodes',
  viaOverlay.nodes.length,
  viaOverlay.nodes.map((n) => n.label).join(' '),
  'links',
  viaOverlay.links.length,
)
// Counterfactual: the same hand-written graph with identity written (sysName = id)
const withIdentity = {
  ...authoredGraph,
  nodes: authoredGraph.nodes.map((n) => ({ ...n, identity: { sysName: n.id } })),
}
const merged = resolve(empty, [
  asSource(withIdentity, 'manual', 100),
  asSource(discovered, 'zabbix', 50),
])
log(
  '2 with identity',
  'nodes',
  merged.nodes.length,
  merged.nodes.map((n) => n.label).join(' '),
  'links',
  merged.links.length,
)

// Stage 3: layout on the merged graph
const { layout } = await computeNetworkLayout(merged)
log('3 layout', 'nodes placed', layout.nodes.size, 'edges', layout.links.size)
