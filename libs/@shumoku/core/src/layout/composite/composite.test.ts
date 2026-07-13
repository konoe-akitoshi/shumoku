// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { DeviceType, type Link, type NetworkGraph, type Node } from '../../models/types.js'
import { placePorts } from '../auto-placement/flat-tree/port-placement.js'
import { resolveNodeSize } from '../engine/index.js'
import { type BoxSpec, findCollinearOverlaps, findNodeOverlaps } from '../invariants.js'
import { getLinkWidthForMode } from '../link-utils.js'
import { portLabelBox } from '../port-geometry.js'
import { buildLayoutProblem } from '../problem.js'
import type { ResolvedEdge, ResolvedPort } from '../resolved-types.js'
import { routeEdges } from '../route-edges.js'
import { layoutComposite, shouldUseComposite, ZONE_SUBGRAPH_PREFIX } from './index.js'
import { alignPortsToPeers, applyOctilinearRoutes, chamferCorners } from './router.js'
import { buildCompositeRoutingPlan } from './routing-plan.js'
import { searchCompositeLayout } from './search.js'

/**
 * Synthetic fixture shaped like the v3 research network (two border
 * routers feeding a distribution pair that fans into zoned access
 * switches + an MLAG pair) — structure only, no real names or addresses.
 */
function fixture(): NetworkGraph {
  const node = (id: string, type: DeviceType, location: string): Node => ({
    id,
    label: id,
    spec: { kind: 'hardware', type },
    metadata: { location },
  })
  const link = (from: string, to: string, gbps: number, extra: Partial<Link> = {}): Link => ({
    from: { node: from, port: `to-${to}` },
    to: { node: to, port: `to-${from}` },
    rateBps: gbps * 1e9,
    ...extra,
  })
  return {
    name: 'composite-fixture',
    nodes: [
      node('border-1', DeviceType.Router, 'core'),
      node('border-2', DeviceType.Router, 'core'),
      node('dist-1', DeviceType.L3Switch, 'dist'),
      node('dist-2', DeviceType.L3Switch, 'dist'),
      node('acc-a1', DeviceType.L2Switch, 'rack-a'),
      node('acc-a2', DeviceType.L2Switch, 'rack-a'),
      node('acc-b1', DeviceType.L2Switch, 'rack-b'),
      node('acc-b2', DeviceType.L2Switch, 'rack-b'),
      node('mlag-1', DeviceType.L3Switch, 'dist'),
      node('mlag-2', DeviceType.L3Switch, 'dist'),
      node('srv-1', DeviceType.Server, 'rack-b'),
      node('srv-2', DeviceType.Server, 'rack-b'),
    ],
    links: [
      link('border-1', 'dist-1', 100),
      link('border-2', 'dist-2', 100),
      link('border-1', 'border-2', 100),
      link('dist-1', 'dist-2', 100),
      link('dist-1', 'acc-a1', 25),
      link('dist-1', 'acc-a2', 25),
      link('dist-2', 'acc-b1', 25),
      link('dist-2', 'acc-b2', 25),
      link('mlag-1', 'mlag-2', 10, { redundancy: 'mlag' }),
      link('dist-1', 'mlag-1', 40),
      link('dist-2', 'mlag-2', 40),
      link('acc-b1', 'srv-1', 10),
      link('acc-b2', 'srv-2', 10),
    ],
  }
}

function boxesOf(nodes: Map<string, Node>): BoxSpec[] {
  const boxes: BoxSpec[] = []
  for (const [id, node] of nodes) {
    if (!node.position) continue
    const size = resolveNodeSize(node)
    boxes.push({
      id,
      x: node.position.x,
      y: node.position.y,
      width: size.width,
      height: size.height,
    })
  }
  return boxes
}

describe('shouldUseComposite', () => {
  it('requires enough nodes with zone metadata', () => {
    expect(shouldUseComposite(fixture())).toBe(true)
    expect(
      shouldUseComposite({ name: 'tiny', nodes: fixture().nodes.slice(0, 4), links: [] }),
    ).toBe(false)
  })
})

describe('layoutComposite', () => {
  it('positions every node and never overlaps boxes', () => {
    const result = layoutComposite(fixture())
    expect(result.nodes.size).toBe(12)
    for (const node of result.nodes.values()) expect(node.position).toBeDefined()
    expect(findNodeOverlaps(boxesOf(result.nodes))).toHaveLength(0)
  })

  it('emits zone boxes that contain their members', () => {
    const result = layoutComposite(fixture())
    const zoneIds = [...result.subgraphs.keys()].filter((id) => id.startsWith(ZONE_SUBGRAPH_PREFIX))
    expect(zoneIds.length).toBeGreaterThanOrEqual(3) // core / dist / rack-a / rack-b
    for (const zoneId of zoneIds) {
      const zone = result.subgraphs.get(zoneId)
      const members = result.zones.get(zoneId.slice(ZONE_SUBGRAPH_PREFIX.length)) ?? []
      expect(zone?.bounds).toBeDefined()
      const bounds = zone?.bounds
      if (!bounds) continue
      for (const memberId of members) {
        const node = result.nodes.get(memberId)
        if (!node?.position) continue
        const size = resolveNodeSize(node)
        expect(node.position.x - size.width / 2).toBeGreaterThanOrEqual(bounds.x - 0.5)
        expect(node.position.x + size.width / 2).toBeLessThanOrEqual(bounds.x + bounds.width + 0.5)
        expect(node.position.y - size.height / 2).toBeGreaterThanOrEqual(bounds.y - 0.5)
        expect(node.position.y + size.height / 2).toBeLessThanOrEqual(
          bounds.y + bounds.height + 0.5,
        )
      }
    }
  })

  it('places the HA pair side by side on one row', () => {
    const result = layoutComposite(fixture())
    const fw1 = result.nodes.get('mlag-1')?.position
    const fw2 = result.nodes.get('mlag-2')?.position
    expect(fw1).toBeDefined()
    expect(fw2).toBeDefined()
    if (!fw1 || !fw2) return
    expect(Math.abs(fw1.y - fw2.y)).toBeLessThan(1)
    expect(Math.abs(fw1.x - fw2.x)).toBeLessThan(260)
  })

  it('puts the apex tier above the access tier', () => {
    const result = layoutComposite(fixture())
    const border = result.nodes.get('border-1')?.position
    const access = result.nodes.get('acc-a1')?.position
    expect(border).toBeDefined()
    expect(access).toBeDefined()
    if (!border || !access) return
    expect(border.y).toBeLessThan(access.y)
  })

  it('is deterministic', () => {
    const a = layoutComposite(fixture())
    const b = layoutComposite(fixture())
    for (const [id, node] of a.nodes) {
      expect(b.nodes.get(id)?.position).toEqual(node.position)
    }
  })
})

describe('alignPortsToPeers', () => {
  it('feeds port-label face demand back into node width', () => {
    const nodes = new Map<string, Node>([
      [
        'parent',
        {
          id: 'parent',
          label: 'parent',
          position: { x: 0, y: 0 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-a',
        {
          id: 'child-a',
          label: 'child-a',
          position: { x: -120, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-b',
        {
          id: 'child-b',
          label: 'child-b',
          position: { x: -40, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-c',
        {
          id: 'child-c',
          label: 'child-c',
          position: { x: 40, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-d',
        {
          id: 'child-d',
          label: 'child-d',
          position: { x: 120, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
    ])
    const edge = (id: string, child: string, portId: string): ResolvedEdge => {
      const fromPort: ResolvedPort = {
        id: `parent:${portId}`,
        nodeId: 'parent',
        label: portId,
        absolutePosition: { x: 0, y: 30 },
        side: 'bottom',
        size: { width: 8, height: 8 },
      }
      const toPort: ResolvedPort = {
        id: `${child}:up`,
        nodeId: child,
        label: 'up',
        absolutePosition: { x: nodes.get(child)?.position?.x ?? 0, y: 150 },
        side: 'top',
        size: { width: 8, height: 8 },
      }
      return {
        id,
        fromPortId: fromPort.id,
        toPortId: toPort.id,
        fromPort,
        toPort,
        fromNodeId: 'parent',
        toNodeId: child,
        fromEndpoint: { node: 'parent', port: portId },
        toEndpoint: { node: child, port: 'up' },
        points: [fromPort.absolutePosition, toPort.absolutePosition],
        width: 2,
        link: { from: { node: 'parent', port: portId }, to: { node: child, port: 'up' } },
      }
    }
    const edges = new Map<string, ResolvedEdge>([
      ['e1', edge('e1', 'child-a', 'Ethernet1')],
      ['e2', edge('e2', 'child-b', 'Ethernet2')],
      ['e3', edge('e3', 'child-c', 'Ethernet3')],
      ['e4', edge('e4', 'child-d', 'Ethernet4')],
    ])

    const result = alignPortsToPeers(edges, nodes)

    expect(result.minWidths.get('parent')).toBeGreaterThan(80)
  })

  it('separates labels on a sufficiently wide same face', () => {
    const nodes = new Map<string, Node>([
      [
        'parent',
        {
          id: 'parent',
          label: 'parent',
          position: { x: 0, y: 0 },
          size: { width: 160, height: 60 },
        },
      ],
      [
        'child-a',
        {
          id: 'child-a',
          label: 'child-a',
          position: { x: -120, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-b',
        {
          id: 'child-b',
          label: 'child-b',
          position: { x: -40, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-c',
        {
          id: 'child-c',
          label: 'child-c',
          position: { x: 40, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'child-d',
        {
          id: 'child-d',
          label: 'child-d',
          position: { x: 120, y: 180 },
          size: { width: 80, height: 60 },
        },
      ],
    ])
    const edges = new Map<string, ResolvedEdge>()
    for (const [index, child] of ['child-a', 'child-b', 'child-c', 'child-d'].entries()) {
      const label = `Ethernet${index + 1}`
      const fromPort: ResolvedPort = {
        id: `parent:${label}`,
        nodeId: 'parent',
        label,
        absolutePosition: { x: 0, y: 30 },
        side: 'bottom',
        size: { width: 8, height: 8 },
      }
      const toPort: ResolvedPort = {
        id: `${child}:up`,
        nodeId: child,
        label: 'up',
        absolutePosition: { x: nodes.get(child)?.position?.x ?? 0, y: 150 },
        side: 'top',
        size: { width: 8, height: 8 },
      }
      edges.set(`e${index}`, {
        id: `e${index}`,
        fromPortId: fromPort.id,
        toPortId: toPort.id,
        fromPort,
        toPort,
        fromNodeId: 'parent',
        toNodeId: child,
        fromEndpoint: { node: 'parent', port: label },
        toEndpoint: { node: child, port: 'up' },
        points: [fromPort.absolutePosition, toPort.absolutePosition],
        width: 2,
        link: { from: { node: 'parent', port: label }, to: { node: child, port: 'up' } },
      })
    }

    alignPortsToPeers(edges, nodes)
    const labels = [...edges.values()]
      .map((edge) => portLabelBox(edge.fromPort))
      .filter((box): box is NonNullable<typeof box> => box !== undefined)

    for (const [i, a] of labels.entries()) {
      for (const b of labels.slice(i + 1)) {
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true)
      }
    }
  })
})

describe('applyOctilinearRoutes', () => {
  it('routes vertical edges as track-separated polylines', async () => {
    const graph = fixture()
    const result = layoutComposite(graph)
    const ports = placePorts(result.nodes, graph.links, 'TB')
    const edges = await routeEdges(result.nodes, ports, graph.links, result.subgraphs)
    // mirror the engine: display (log) widths drive routing separation
    for (const edge of edges.values()) {
      edge.width = Math.max(1, getLinkWidthForMode(edge.link, 'log'))
    }
    const routed = applyOctilinearRoutes(edges)
    expect(routed).toBeGreaterThan(0)
    const lines = [...edges.values()]
      .filter((edge) => edge.route !== undefined)
      .map((edge) => ({
        id: edge.id,
        points: edge.route?.points ?? edge.points,
        halfWidth: Math.max(0.5, edge.width / 2),
      }))
    expect(findCollinearOverlaps(lines)).toHaveLength(0)
  })

  it('does not bundle searched primary fan-outs into comb buses', async () => {
    const result = await searchCompositeLayout(fixture(), { maxEvaluations: 1 })
    expect([...result.edges.values()].some((edge) => edge.route?.kind === 'bus')).toBe(false)
    expect(result.constraints.blockingViolations).toHaveLength(0)
  })
  it('builds routing plans from semantic intents instead of router heuristics', async () => {
    const graph = fixture()
    const comp = layoutComposite(graph)
    const ports = placePorts(comp.nodes, graph.links, 'TB')
    const edges = await routeEdges(comp.nodes, ports, graph.links, comp.subgraphs)
    const plan = buildCompositeRoutingPlan(buildLayoutProblem(graph), comp, edges)

    expect(plan.combs.size).toBe(0)
    expect(plan.rampEdges.size).toBeGreaterThan(0)
    expect(plan.gutterEdges.size).toBe(0)
  })
  it('only uses lateral ramps for explicitly allowed peer edges', () => {
    const port = (
      nodeId: string,
      id: string,
      x: number,
      y: number,
      side: ResolvedPort['side'],
    ): ResolvedPort => ({
      id: `${nodeId}:${id}`,
      nodeId,
      label: id,
      absolutePosition: { x, y },
      side,
      size: { width: 8, height: 8 },
    })
    const edge = (): ResolvedEdge => {
      const fromPort = port('left-peer', 'peer', 0, 0, 'right')
      const toPort = port('right-peer', 'peer', 120, 0, 'left')
      return {
        id: 'e-peer',
        fromPortId: fromPort.id,
        toPortId: toPort.id,
        fromPort,
        toPort,
        fromNodeId: 'left-peer',
        toNodeId: 'right-peer',
        fromEndpoint: { node: 'left-peer', port: fromPort.label },
        toEndpoint: { node: 'right-peer', port: toPort.label },
        points: [fromPort.absolutePosition, toPort.absolutePosition],
        width: 2,
        link: {
          from: { node: 'left-peer', port: fromPort.label },
          to: { node: 'right-peer', port: toPort.label },
        },
      }
    }

    const blocked = new Map<string, ResolvedEdge>([['e-peer', edge()]])
    applyOctilinearRoutes(blocked)
    expect(blocked.get('e-peer')?.route).toBeUndefined()

    const allowed = new Map<string, ResolvedEdge>([['e-peer', edge()]])
    applyOctilinearRoutes(allowed, { routingPlan: { rampEdges: new Set(['e-peer']) } })
    expect(allowed.get('e-peer')?.route?.kind).toBe('polyline')
    expect(allowed.get('e-peer')?.points).toHaveLength(6)
  })

  it('keeps short one-row links out of subgraph gutters', () => {
    const verticalEdge = (id: string, y2: number): ResolvedEdge => {
      const fromPort: ResolvedPort = {
        id: `parent:${id}`,
        nodeId: 'parent',
        label: id,
        absolutePosition: { x: 0, y: 0 },
        side: 'bottom',
        size: { width: 8, height: 8 },
      }
      const toPort: ResolvedPort = {
        id: `child:${id}`,
        nodeId: 'child',
        label: id,
        absolutePosition: { x: 120, y: y2 },
        side: 'top',
        size: { width: 8, height: 8 },
      }
      return {
        id,
        fromPortId: fromPort.id,
        toPortId: toPort.id,
        fromPort,
        toPort,
        fromNodeId: 'parent',
        toNodeId: 'child',
        fromEndpoint: { node: 'parent', port: fromPort.label },
        toEndpoint: { node: 'child', port: toPort.label },
        points: [fromPort.absolutePosition, toPort.absolutePosition],
        width: 2,
        link: {
          from: { node: 'parent', port: fromPort.label },
          to: { node: 'child', port: toPort.label },
        },
      }
    }
    const obstacles = [{ id: 'zone', bounds: { x: -20, y: 20, width: 160, height: 210 } }]

    const short = new Map<string, ResolvedEdge>([['short', verticalEdge('short', 140)]])
    applyOctilinearRoutes(short, { obstacles, routingPlan: { gutterEdges: new Set(['short']) } })
    expect(short.get('short')?.points).toHaveLength(4)

    const long = new Map<string, ResolvedEdge>([['long', verticalEdge('long', 260)]])
    applyOctilinearRoutes(long, { obstacles, routingPlan: { gutterEdges: new Set(['long']) } })
    expect(long.get('long')?.points).toHaveLength(6)
  })
  it('does not keep singleton child rows in a comb bus', () => {
    const port = (
      nodeId: string,
      id: string,
      x: number,
      y: number,
      side: ResolvedPort['side'],
    ): ResolvedPort => ({
      id: `${nodeId}:${id}`,
      nodeId,
      label: id,
      absolutePosition: { x, y },
      side,
      size: { width: 8, height: 8 },
    })
    const link = (from: string, to: string): Link => ({
      from: { node: from, port: `to-${to}` },
      to: { node: to, port: `to-${from}` },
    })
    const edge = (id: string, child: string, px: number, cx: number, cy: number): ResolvedEdge => {
      const fromPort = port('parent', `p-${id}`, px, 0, 'bottom')
      const toPort = port(child, `p-${id}`, cx, cy, 'top')
      return {
        id,
        fromPortId: fromPort.id,
        toPortId: toPort.id,
        fromPort,
        toPort,
        fromNodeId: 'parent',
        toNodeId: child,
        fromEndpoint: { node: 'parent', port: fromPort.label },
        toEndpoint: { node: child, port: toPort.label },
        points: [fromPort.absolutePosition, toPort.absolutePosition],
        width: 2,
        link: link('parent', child),
      }
    }

    const edges = new Map<string, ResolvedEdge>([
      ['e0', edge('e0', 'child-a', -20, -60, 120)],
      ['e1', edge('e1', 'child-b', 20, 60, 120)],
      ['e2', edge('e2', 'child-c', 60, 160, 240)],
    ])

    applyOctilinearRoutes(edges, {
      routingPlan: { combs: new Map([['parent', ['e0', 'e1', 'e2']]]) },
    })

    expect(edges.get('e0')?.route?.kind).toBe('bus')
    expect(edges.get('e1')?.route?.kind).toBe('bus')
    expect(edges.get('e0')?.route?.branchCount).toBe(2)
    expect(edges.get('e2')?.route?.kind).toBe('polyline')
  })
})

describe('chamferCorners', () => {
  it('cuts 90° corners and leaves straights alone', () => {
    const cut = chamferCorners(
      [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      10,
    )
    expect(cut).toHaveLength(4)
    expect(cut[1]).toEqual({ x: 0, y: 90 })
    expect(cut[2]).toEqual({ x: 10, y: 100 })
    const straight = chamferCorners(
      [
        { x: 0, y: 0 },
        { x: 0, y: 200 },
      ],
      10,
    )
    expect(straight).toHaveLength(2)
  })
})

describe('alignPortsToPeers — shared ports', () => {
  // Several links wired into ONE port object (LLDP reporting many devices
  // behind a single switch port, breakouts). The per-edge seating loop
  // assumes 1 port = 1 link; without the aggregate pass the shared port's
  // face was last-writer-wins over edge order.
  const build = (edgeOrder: 'forward' | 'reverse') => {
    const nodes = new Map<string, Node>([
      [
        'hub',
        { id: 'hub', label: 'hub', position: { x: 0, y: 0 }, size: { width: 80, height: 60 } },
      ],
      [
        'below-a',
        {
          id: 'below-a',
          label: 'a',
          position: { x: -80, y: 200 },
          size: { width: 80, height: 60 },
        },
      ],
      [
        'below-b',
        { id: 'below-b', label: 'b', position: { x: 80, y: 200 }, size: { width: 80, height: 60 } },
      ],
      [
        'above-c',
        { id: 'above-c', label: 'c', position: { x: 0, y: -200 }, size: { width: 80, height: 60 } },
      ],
    ])
    // ONE shared hub port for all three links.
    const hubPort: ResolvedPort = {
      id: 'hub:Ethernet1',
      nodeId: 'hub',
      label: 'Ethernet1',
      absolutePosition: { x: 0, y: 30 },
      side: 'bottom',
      size: { width: 8, height: 8 },
    }
    const edge = (id: string, peer: string): ResolvedEdge => {
      const toPort: ResolvedPort = {
        id: `${peer}:up`,
        nodeId: peer,
        label: 'up',
        absolutePosition: { x: nodes.get(peer)?.position?.x ?? 0, y: 170 },
        side: 'top',
        size: { width: 8, height: 8 },
      }
      return {
        id,
        fromPortId: hubPort.id,
        toPortId: toPort.id,
        fromPort: hubPort,
        toPort,
        fromNodeId: 'hub',
        toNodeId: peer,
        fromEndpoint: { node: 'hub', port: 'Ethernet1' },
        toEndpoint: { node: peer, port: 'up' },
        points: [hubPort.absolutePosition, toPort.absolutePosition],
        width: 2,
        link: { from: { node: 'hub', port: 'Ethernet1' }, to: { node: peer, port: 'up' } },
      }
    }
    const list =
      edgeOrder === 'forward'
        ? [edge('e1', 'below-a'), edge('e2', 'below-b'), edge('e3', 'above-c')]
        : [edge('e3', 'above-c'), edge('e2', 'below-b'), edge('e1', 'below-a')]
    const edges = new Map<string, ResolvedEdge>(list.map((e) => [e.id, e]))
    return { nodes, edges, hubPort }
  }

  it('seats a multi-link port once, toward the mean of its peers', () => {
    const { nodes, edges, hubPort } = build('forward')
    alignPortsToPeers(edges, nodes)
    // Two peers below, one above → mean peer is below → bottom face.
    expect(hubPort.side).toBe('bottom')
  })

  it('is independent of edge iteration order (no last-writer-wins)', () => {
    const a = build('forward')
    alignPortsToPeers(a.edges, a.nodes)
    const b = build('reverse')
    alignPortsToPeers(b.edges, b.nodes)
    expect(a.hubPort.side).toBe(b.hubPort.side)
  })

  it('single-link ports keep the existing per-edge seating', () => {
    const { nodes, edges } = build('forward')
    alignPortsToPeers(edges, nodes)
    // The above-child's own (unshared) port faces the hub below it.
    const e3 = edges.get('e3')
    expect(e3?.toPort.side).toBe('bottom')
  })
})
