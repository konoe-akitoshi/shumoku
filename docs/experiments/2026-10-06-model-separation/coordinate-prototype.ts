// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  autoLayoutFlatTree,
  createEngine,
  type NetworkGraph,
  nodesOverlap,
  placePorts,
  type ResolvedLayout,
  routeEdges,
} from '../../../libs/@shumoku/core/dist/index.js'
import { z } from '../../../libs/@shumoku/core/node_modules/zod'
import { renderSvgString } from '../../../libs/@shumoku/renderer/src/static'

// Experiment-only subsets. These are not the proposed public model schemas.
const id = z.string().min(1)
const attributes = z.record(z.string(), z.unknown())
const aPort = z.strictObject({ id, label: z.string(), interfaceName: z.string() })
const aEndpoint = z.strictObject({ node: id, port: id })
const topologyA = z.strictObject({
  id,
  version: z.literal('1.0'),
  nodes: z.array(
    z.strictObject({ id, label: z.string(), ports: z.array(aPort), metadata: attributes }),
  ),
  links: z.array(z.strictObject({ id, from: aEndpoint, to: aEndpoint, metadata: attributes })),
})
const topologyB = z.strictObject({
  schemaVersion: z.literal('0.1.0-draft'),
  id,
  nodes: z.array(z.strictObject({ id, name: z.string(), attributes })),
  ports: z.array(z.strictObject({ id, nodeId: id, interfaceName: z.string() })),
  connections: z.array(
    z.strictObject({
      id,
      endpoints: z.tuple([z.strictObject({ portId: id }), z.strictObject({ portId: id })]),
      attributes,
    }),
  ),
  groups: z.array(z.strictObject({ id, name: z.string(), nodeIds: z.array(id) })),
})
const position = z.strictObject({ x: z.number().finite(), y: z.number().finite() })
const size = z.strictObject({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
})
const color = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
const strokeStyle = {
  stroke: color.optional(),
  strokeWidth: z.number().finite().positive().optional(),
  strokeDasharray: z
    .string()
    .regex(/^\d+(?:\.\d+)?(?:[ ,]+\d+(?:\.\d+)?)*$/)
    .optional(),
}
const presentationSchema = z.strictObject({
  id,
  topologyId: id,
  nodePlacements: z.array(z.strictObject({ nodeId: id, position })),
  nodeSizes: z.array(z.strictObject({ nodeId: id, size })).optional(),
  direction: z.enum(['TB', 'BT', 'LR', 'RL']).optional(),
  layerGap: z.number().finite().positive().optional(),
  nodeStyles: z
    .array(
      z.strictObject({
        nodeId: id,
        style: z.strictObject({ fill: color.optional(), ...strokeStyle }),
      }),
    )
    .optional(),
  connectionStyles: z
    .array(
      z.strictObject({
        connectionId: id,
        style: z.strictObject(strokeStyle),
      }),
    )
    .optional(),
  portPlacements: z.array(
    z.strictObject({
      portId: id,
      side: z.enum(['top', 'bottom', 'left', 'right']),
      order: z.number().finite().optional(),
    }),
  ),
})

export type TopologyA = z.infer<typeof topologyA>
export type TopologyB = z.infer<typeof topologyB>
export type Presentation = z.infer<typeof presentationSchema>
export type ExperimentInput =
  | { candidate: 'A'; topology: TopologyA }
  | { candidate: 'B'; topology: TopologyB }

export function parseTopology(candidate: 'A', value: unknown): TopologyA
export function parseTopology(candidate: 'B', value: unknown): TopologyB
export function parseTopology(candidate: 'A' | 'B', value: unknown): TopologyA | TopologyB {
  return candidate === 'A' ? topologyA.parse(value) : topologyB.parse(value)
}

export function parsePresentation(value: unknown): Presentation {
  return presentationSchema.parse(value)
}

function uniqueIds(ids: string[], kind: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${kind} ID`)
}

// One-way renderer adaptation. Never persist or merge this graph back into topology.
export function deriveGraph(input: ExperimentInput, presentation: Presentation): NetworkGraph {
  if (presentation.topologyId !== input.topology.id) throw new Error('Wrong topologyId')
  const topology = structuredClone(input.topology)
  const graph: NetworkGraph = { version: '1.0', nodes: [], links: [] }
  if (input.candidate === 'A') {
    const a = topologyA.parse(topology)
    graph.nodes = a.nodes.map((node) => ({
      ...node,
      ports: node.ports.map((port) => ({ ...port, connectors: [] })),
    }))
    graph.links = a.links
  } else {
    const b = topologyB.parse(topology)
    const ports = new Map(b.ports.map((port) => [port.id, port]))
    for (const port of b.ports) {
      if (!b.nodes.some((node) => node.id === port.nodeId)) throw new Error('Missing port owner')
    }
    graph.nodes = b.nodes.map((node) => ({
      id: node.id,
      label: node.name,
      metadata: node.attributes,
      ports: b.ports
        .filter((port) => port.nodeId === node.id)
        .map((port) => ({
          id: port.id,
          label: port.interfaceName,
          interfaceName: port.interfaceName,
          connectors: [],
        })),
    }))
    graph.links = b.connections.map((connection) => {
      const [first, second] = connection.endpoints
      const from = ports.get(first.portId)
      const to = ports.get(second.portId)
      if (!from || !to) throw new Error('Missing connection port')
      return {
        id: connection.id,
        from: { node: from.nodeId, port: from.id },
        to: { node: to.nodeId, port: to.id },
        metadata: connection.attributes,
      }
    })
  }

  // This experiment requires global port IDs even for A, to share presentation fixtures.
  uniqueIds(
    [
      ...graph.nodes.map((node) => node.id),
      ...graph.nodes.flatMap((node) => node.ports?.map((port) => port.id) ?? []),
      ...graph.links.map((link) => link.id ?? ''),
    ],
    'element',
  )
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const ports = new Map(graph.nodes.flatMap((node) => node.ports?.map((p) => [p.id, p]) ?? []))
  const links = new Map(graph.links.map((link) => [link.id, link]))
  for (const link of graph.links) {
    for (const endpoint of [link.from, link.to]) {
      if (!nodes.get(endpoint.node)?.ports?.some((port) => port.id === endpoint.port)) {
        throw new Error('Missing connection port or wrong owner')
      }
    }
  }
  uniqueIds(
    presentation.nodePlacements.map((p) => p.nodeId),
    'node placement',
  )
  uniqueIds(
    presentation.portPlacements.map((p) => p.portId),
    'port placement',
  )
  for (const placement of presentation.nodePlacements) {
    const node = nodes.get(placement.nodeId)
    if (!node) throw new Error('Missing presentation node')
    node.position = { ...placement.position }
  }
  uniqueIds(
    (presentation.nodeSizes ?? []).map((p) => p.nodeId),
    'node size',
  )
  for (const requested of presentation.nodeSizes ?? []) {
    const node = nodes.get(requested.nodeId)
    if (!node) throw new Error('Missing presentation size node')
    node.size = { ...requested.size }
  }
  for (const placement of presentation.portPlacements) {
    const port = ports.get(placement.portId)
    if (!port) throw new Error('Missing presentation port')
    port.placement = { side: placement.side, order: placement.order }
  }
  uniqueIds(
    (presentation.nodeStyles ?? []).map((entry) => entry.nodeId),
    'node style',
  )
  uniqueIds(
    (presentation.connectionStyles ?? []).map((p) => p.connectionId),
    'connection style',
  )
  for (const entry of presentation.nodeStyles ?? []) {
    const node = nodes.get(entry.nodeId)
    if (!node) throw new Error('Missing style node')
    node.style = { ...entry.style }
  }
  for (const entry of presentation.connectionStyles ?? []) {
    const link = links.get(entry.connectionId)
    if (!link) throw new Error('Missing style connection')
    link.style = { ...entry.style }
  }
  graph.settings = presentation.direction ? { direction: presentation.direction } : undefined
  return graph
}

export async function prepareExperiment(input: ExperimentInput, presentation: Presentation) {
  const parsed = parsePresentation(presentation)
  const graph = deriveGraph(input, parsed)
  const requests = new Map((parsed.nodeSizes ?? []).map((p) => [p.nodeId, p.size]))
  const engine = createEngine()
  // Local experiment policy: supply explicit footprints BEFORE automatic placement.
  // The existing default engine computes a minimum from label/port content.
  const direction = parsed.direction ?? 'TB'
  const arranged = autoLayoutFlatTree(
    graph,
    {
      ...engine,
      nodeFootprint(node, context) {
        const minimum = engine.nodeFootprint(node, context)
        const requested = requests.get(node.id)
        if (!requested) return minimum
        if (requested.width < minimum.width || requested.height < minimum.height) {
          throw new Error(
            `Display size too small for ${node.id}; minimum ${minimum.width} x ${minimum.height}`,
          )
        }
        return { ...requested }
      },
    },
    {
      direction,
      ...(parsed.layerGap === undefined ? {} : { layerGap: parsed.layerGap }),
      fixed: new Set(parsed.nodePlacements.map((placement) => placement.nodeId)),
    },
  )
  const fixedPositions = new Map(parsed.nodePlacements.map((p) => [p.nodeId, p.position]))
  const geometry = [...arranged.nodes.values()].map((node) => ({
    ...node,
    position: fixedPositions.get(node.id) ?? node.position,
  }))
  for (const [index, node] of geometry.entries()) {
    if (!node.position || !node.size) throw new Error('Missing resolved geometry')
    for (const other of geometry.slice(index + 1)) {
      if (!other.position || !other.size) throw new Error('Missing resolved geometry')
      if (
        nodesOverlap(
          { ...node.position, w: node.size.width, h: node.size.height },
          { ...other.position, w: other.size.width, h: other.size.height },
          0,
        )
      )
        throw new Error(`Display nodes overlap: ${node.id}, ${other.id}`)
    }
  }
  for (const placement of parsed.nodePlacements) {
    const actual = arranged.nodes.get(placement.nodeId)?.position
    if (actual?.x !== placement.position.x || actual.y !== placement.position.y) {
      throw new Error(`Layout changed fixed position: ${placement.nodeId}`)
    }
  }
  // Fixed positions can change peer ordering after the first port-placement pass.
  const ports = placePorts(arranged.nodes, graph.links, direction)
  const usedOrders = new Set<string>()
  for (const placement of parsed.portPlacements) {
    const node = graph.nodes.find((n) => n.ports?.some((p) => p.id === placement.portId))
    const port = node ? ports.get(`${node.id}:${placement.portId}`) : undefined
    if (!port) throw new Error(`Presentation port is not rendered: ${placement.portId}`)
    if (placement.order !== undefined) {
      const key = JSON.stringify([node?.id, port.side, placement.order])
      if (usedOrders.has(key)) throw new Error('Duplicate port order on one node side')
      usedOrders.add(key)
    }
  }
  const edges = await routeEdges(arranged.nodes, ports, graph.links, arranged.subgraphs)
  if (edges.size !== graph.links.length) throw new Error('Renderer dropped a connection')
  const resolved: ResolvedLayout = { ...arranged, ports, edges }
  return { graph, resolved, svg: renderSvgString(resolved) }
}

export async function loadFixtures() {
  const readJson = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
  const a = parseTopology('A', await readJson('./topology-a.json'))
  const b = parseTopology(
    'B',
    await readJson('../../examples/network-model/router-switch.network.json'),
  )
  const presentations = [
    parsePresentation(await readJson('./vertical.presentation.json')),
    parsePresentation(await readJson('./horizontal.presentation.json')),
  ]
  const physicalProfile = await readJson(
    '../../examples/network-model/router-switch.route-profile.json',
  )
  const multiport = {
    a: parseTopology('A', await readJson('./multiport.topology-a.json')),
    b: parseTopology('B', await readJson('./multiport.topology-b.json')),
    presentations: [
      parsePresentation(await readJson('./multiport.forward.presentation.json')),
      parsePresentation(await readJson('./multiport.reverse.presentation.json')),
    ],
  }
  const styled = {
    a: parseTopology('A', await readJson('./styled.topology-a.json')),
    b: parseTopology('B', await readJson('./styled.topology-b.json')),
    presentations: [
      parsePresentation(await readJson('./styled.tb.presentation.json')),
      parsePresentation(await readJson('./styled.lr.presentation.json')),
    ],
  }
  return { a, b, presentations, physicalProfile, multiport, styled }
}

// Exercise an actual JSON file boundary, including the independent physical profile.
export async function saveAndReload(fixtures: Awaited<ReturnType<typeof loadFixtures>>) {
  const path = join(tmpdir(), `shumoku-coordinate-${randomUUID()}.json`)
  await writeFile(path, JSON.stringify(fixtures), 'utf8')
  try {
    const saved = z
      .strictObject({
        a: topologyA,
        b: topologyB,
        presentations: z.array(presentationSchema),
        physicalProfile: z.unknown(),
        multiport: z.strictObject({
          a: topologyA,
          b: topologyB,
          presentations: z.array(presentationSchema),
        }),
        styled: z.strictObject({
          a: topologyA,
          b: topologyB,
          presentations: z.array(presentationSchema),
        }),
      })
      .parse(JSON.parse(await readFile(path, 'utf8')))
    return saved
  } finally {
    await unlink(path)
  }
}
