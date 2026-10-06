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
const presentationSchema = z.strictObject({
  id,
  topologyId: id,
  nodePlacements: z.array(z.strictObject({ nodeId: id, position })),
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
  for (const placement of presentation.portPlacements) {
    const port = ports.get(placement.portId)
    if (!port) throw new Error('Missing presentation port')
    port.placement = { side: placement.side, order: placement.order }
  }
  return graph
}

export async function prepareExperiment(input: ExperimentInput, presentation: Presentation) {
  const graph = deriveGraph(input, parsePresentation(presentation))
  const arranged = autoLayoutFlatTree(graph, createEngine(), {
    fixed: new Set(presentation.nodePlacements.map((placement) => placement.nodeId)),
  })
  const edges = await routeEdges(arranged.nodes, arranged.ports, graph.links, arranged.subgraphs)
  if (edges.size !== graph.links.length) throw new Error('Renderer dropped a connection')
  const resolved: ResolvedLayout = { ...arranged, edges }
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
  return { a, b, presentations, physicalProfile }
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
      })
      .parse(JSON.parse(await readFile(path, 'utf8')))
    return saved
  } finally {
    await unlink(path)
  }
}
