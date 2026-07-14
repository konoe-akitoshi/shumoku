// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { DeviceType, type Link, type NetworkGraph, type Node } from '../models/types.js'
import { layoutComposite } from './composite/index.js'
import { buildLayoutProblem, computeRoleDrivenRanks, verifySemanticLayout } from './problem.js'

function graph(): NetworkGraph {
  const node = (id: string, type: DeviceType, location: string): Node => ({
    id,
    label: id,
    spec: { kind: 'hardware', type },
    metadata: { location },
  })
  const link = (from: string, to: string, gbps = 10): Link => ({
    from: { node: from, port: `to-${to}` },
    to: { node: to, port: `to-${from}` },
    rateBps: gbps * 1e9,
  })
  return {
    name: 'layout-problem-fixture',
    nodes: [
      node('r1', DeviceType.Router, 'core'),
      node('d1', DeviceType.L3Switch, 'dist-a'),
      node('d2', DeviceType.L3Switch, 'dist-b'),
      node('a1', DeviceType.L2Switch, 'rack-a'),
      node('a2', DeviceType.L2Switch, 'rack-b'),
      node('s1', DeviceType.Server, 'rack-a'),
      node('s2', DeviceType.Server, 'rack-b'),
      node('s3', DeviceType.Server, 'rack-b'),
      node('ap1', DeviceType.AccessPoint, 'rack-a'),
      node('ap2', DeviceType.AccessPoint, 'rack-b'),
    ],
    links: [
      link('r1', 'd1', 100),
      link('r1', 'd2', 100),
      link('d1', 'a1', 25),
      link('d2', 'a2', 25),
      link('a1', 's1'),
      link('a2', 's2'),
      link('a2', 's3'),
      link('a1', 'ap1'),
      link('a2', 'ap2'),
    ],
  }
}

describe('buildLayoutProblem', () => {
  it('extracts semantic, geometry, and objective layers', () => {
    const problem = buildLayoutProblem(graph())

    expect(problem.mode).toBe('role-driven')
    expect(problem.nodes).toHaveLength(10)
    expect(problem.groups.map((group) => group.source)).toContain('location')
    expect(problem.groupAffinities.length).toBeGreaterThan(0)
    expect(problem.hardConstraints.some((constraint) => constraint.kind === 'containment')).toBe(
      true,
    )
    expect(problem.semanticConstraints.some((constraint) => constraint.kind === 'tier-order')).toBe(
      true,
    )
    expect(
      problem.semanticConstraints.some((constraint) => constraint.kind === 'same-rank-horizontal'),
    ).toBe(true)
    expect(problem.objectives.map((objective) => objective.kind)).toContain('compactness')
    expect(problem.routingIntents.map((intent) => intent.kind)).toContain('primary-downstream')
    expect(problem.diagnostics.apexNodeId).toBe('r1')
  })

  it('keeps compactness as an objective rather than a semantic constraint', () => {
    const problem = buildLayoutProblem(graph())

    expect(problem.semanticConstraints.map((constraint) => constraint.kind)).not.toContain(
      'compactness',
    )
    expect(problem.objectives.some((objective) => objective.kind === 'compactness')).toBe(true)
  })

  it('classifies peer links as ramp-capable routing intent', () => {
    const source: NetworkGraph = {
      name: 'peer-link',
      nodes: [
        {
          id: 'dist-01',
          label: 'dist-01',
          parent: 'site',
          spec: { kind: 'hardware', type: DeviceType.L3Switch },
        },
        {
          id: 'dist-02',
          label: 'dist-02',
          parent: 'site',
          spec: { kind: 'hardware', type: DeviceType.L3Switch },
        },
      ],
      links: [
        { id: 'peer', from: { node: 'dist-01', port: 'a' }, to: { node: 'dist-02', port: 'a' } },
      ],
      subgraphs: [{ id: 'site', label: 'Site' }],
    }

    const problem = buildLayoutProblem(source)
    const intent = problem.routingIntents.find((candidate) => candidate.linkId === 'peer')

    expect(intent?.kind).toBe('same-tier-peer')
    expect(intent?.allowedGrammars).toContain('lateral-ramp')
  })
  it('lets topology direction outrank soft device-tier hints', () => {
    const source: NetworkGraph = {
      name: 'firewall-flow',
      nodes: [
        { id: 'edge', label: 'edge-rt-01', spec: { kind: 'hardware', type: DeviceType.Router } },
        { id: 'fw', label: 'fw-01', spec: { kind: 'hardware', type: DeviceType.Firewall } },
        { id: 'core', label: 'core-sw-01', spec: { kind: 'hardware', type: DeviceType.L3Switch } },
      ],
      links: [
        { from: { node: 'edge', port: 'to-fw' }, to: { node: 'fw', port: 'to-edge' } },
        { from: { node: 'fw', port: 'to-core' }, to: { node: 'core', port: 'to-fw' } },
      ],
    }

    const problem = buildLayoutProblem(source)
    const ranks = computeRoleDrivenRanks(source)

    expect(problem.diagnostics.apexNodeId).toBe('edge')
    expect(ranks.get('edge')).toBeLessThan(ranks.get('fw') ?? Number.POSITIVE_INFINITY)
    expect(ranks.get('fw')).toBeLessThan(ranks.get('core') ?? Number.POSITIVE_INFINITY)
  })

  it('demotes a stub-tagged router when the fat trunks point elsewhere', () => {
    // Role metadata can point at the wrong box: the only `router` in this
    // inventory is a degree-1 management box off an access switch, while the
    // real WAN edge is a `generic` switch terminating the 400G trunk. The
    // wiring must win — rooting at the stub inverts the whole map.
    const source: NetworkGraph = {
      name: 'stub-router',
      nodes: [
        { id: 'wan-edge', label: 'wan-edge', spec: { kind: 'hardware', type: DeviceType.Generic } },
        { id: 'agg', label: 'agg', spec: { kind: 'hardware', type: DeviceType.Generic } },
        { id: 'core', label: 'core', spec: { kind: 'hardware', type: DeviceType.Generic } },
        { id: 'eps', label: 'eps', spec: { kind: 'hardware', type: DeviceType.Generic } },
        { id: 'stub-rtr', label: 'stub-rtr', spec: { kind: 'hardware', type: DeviceType.Router } },
        { id: 'ap1', label: 'ap1', spec: { kind: 'hardware', type: DeviceType.AccessPoint } },
      ],
      links: [
        {
          from: { node: 'wan-edge', port: 'a' },
          to: { node: 'agg', port: 'a' },
          rateBps: 400e9,
        },
        { from: { node: 'agg', port: 'b' }, to: { node: 'core', port: 'a' } },
        { from: { node: 'core', port: 'b' }, to: { node: 'eps', port: 'a' } },
        { from: { node: 'eps', port: 'b' }, to: { node: 'stub-rtr', port: 'a' } },
        { from: { node: 'eps', port: 'c' }, to: { node: 'ap1', port: 'a' } },
      ],
    }

    const problem = buildLayoutProblem(source)
    const ranks = computeRoleDrivenRanks(source)

    expect(problem.diagnostics.apexNodeId).toBe('wan-edge')
    // The stub router sits BELOW the switch it hangs off, not at the top.
    expect(ranks.get('stub-rtr')).toBeGreaterThan(ranks.get('eps') ?? Number.POSITIVE_INFINITY)
    expect(ranks.get('wan-edge')).toBe(0)
    expect(ranks.get('core')).toBeGreaterThan(ranks.get('agg') ?? Number.POSITIVE_INFINITY)
  })

  it('never seeds the rank root at a leaf class (AP) when no hierarchy info exists', () => {
    // All-generic switches + APs: no boundary role, no bandwidth. The lowest
    // resolvable tier is the APs' — rooting there is the inversion bug. The
    // root must fall through to structure (highest degree) instead.
    const source: NetworkGraph = {
      name: 'aps-only',
      nodes: [
        { id: 'sw1', label: 'sw1', spec: { kind: 'hardware', type: DeviceType.Generic } },
        { id: 'sw2', label: 'sw2', spec: { kind: 'hardware', type: DeviceType.Generic } },
        { id: 'ap1', label: 'ap1', spec: { kind: 'hardware', type: DeviceType.AccessPoint } },
        { id: 'ap2', label: 'ap2', spec: { kind: 'hardware', type: DeviceType.AccessPoint } },
        { id: 'ap3', label: 'ap3', spec: { kind: 'hardware', type: DeviceType.AccessPoint } },
      ],
      links: [
        { from: { node: 'sw1', port: 'a' }, to: { node: 'sw2', port: 'a' } },
        { from: { node: 'sw1', port: 'b' }, to: { node: 'ap1', port: 'a' } },
        { from: { node: 'sw1', port: 'c' }, to: { node: 'ap2', port: 'a' } },
        { from: { node: 'sw2', port: 'b' }, to: { node: 'ap3', port: 'a' } },
      ],
    }

    const problem = buildLayoutProblem(source)
    const ranks = computeRoleDrivenRanks(source)

    expect(problem.diagnostics.apexNodeId).toBe('sw1')
    for (const ap of ['ap1', 'ap2', 'ap3']) {
      expect(ranks.get(ap)).toBeGreaterThan(0)
    }
  })

  it('anchors the apex to the rank root, not raw cable direction', () => {
    // Inventory cables are undirected: from→to is arbitrary. Here every cable
    // is written leaf-first, so a direction-based heuristic would crown a
    // Server (in-degree 0) as the apex. The apex must instead be the rank
    // root — the WAN edge the placement grows the tree from.
    const source: NetworkGraph = {
      name: 'undirected-backwards',
      nodes: [
        { id: 'core', label: 'core', spec: { kind: 'hardware', type: DeviceType.Router } },
        { id: 'swa', label: 'swa', spec: { kind: 'hardware', type: DeviceType.L3Switch } },
        { id: 'swb', label: 'swb', spec: { kind: 'hardware', type: DeviceType.L3Switch } },
        { id: 's1', label: 's1', spec: { kind: 'hardware', type: DeviceType.Server } },
        { id: 's2', label: 's2', spec: { kind: 'hardware', type: DeviceType.Server } },
      ],
      links: [
        { from: { node: 's1', port: 'a' }, to: { node: 'swa', port: 'a' } },
        { from: { node: 's2', port: 'a' }, to: { node: 'swb', port: 'a' } },
        { from: { node: 'swa', port: 'b' }, to: { node: 'core', port: 'a' } },
        { from: { node: 'swb', port: 'b' }, to: { node: 'core', port: 'b' } },
      ],
    }

    const problem = buildLayoutProblem(source)

    expect(problem.diagnostics.apexNodeId).toBe('core')
    const centering = problem.semanticConstraints.filter((c) => c.kind === 'apex-centering')
    expect(centering).toHaveLength(1)
    const first = centering[0]
    if (first?.kind === 'apex-centering') {
      // children are the apex's neighbours one rank deeper, from the shared
      // rank — not the raw cable endpoints.
      expect(first.apexNodeId).toBe('core')
      expect(first.childNodeIds).toEqual(['swa', 'swb'])
    }
  })
})

describe('verifySemanticLayout', () => {
  it('reports tier-order violations from positioned nodes', () => {
    const source = graph()
    const problem = buildLayoutProblem(source)
    const nodes = new Map(
      source.nodes.map((node) => [
        node.id,
        {
          ...node,
          position: node.id === 'r1' ? { x: 100, y: 500 } : { x: 100, y: 100 },
        },
      ]),
    )

    const report = verifySemanticLayout(problem, nodes)

    expect(report.ok).toBe(false)
    expect(report.counts['tier-order']).toBeGreaterThan(0)
  })

  it('accepts the current composite layout for the semantic fixture', () => {
    const source = graph()
    const problem = buildLayoutProblem(source)
    const layout = layoutComposite(source)

    const report = verifySemanticLayout(problem, layout.nodes, layout.subgraphs)

    expect(report.counts['tier-order']).toBe(0)
  })
})
