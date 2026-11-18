// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import type { DrawingScene, NetworkGraph } from '@shumoku/core'
import { createShareApplicationService } from '../src/app/share.ts'
import type { DashboardService } from '../src/services/dashboard.ts'
import type { DataSourceService } from '../src/services/datasource.ts'
import type { ParsedTopology, TopologyService } from '../src/services/topology.ts'

const graph = {
  version: '1',
  name: 'net',
  nodes: [{ id: 'sw1', label: 'core-sw' }],
  links: [],
} as unknown as NetworkGraph

const scene = {
  nodes: [{ node: { id: 'sw1', label: 'core-sw' }, box: { x: 0, y: 0, width: 80, height: 40 } }],
  groups: [],
  wires: [],
  ports: [],
  captions: [],
  hulls: [],
  bounds: { x: 0, y: 0, width: 80, height: 40 },
} as unknown as DrawingScene

const parsed = { id: 't1', name: 'net', graph, scene } as unknown as ParsedTopology

const topologies = {
  get: (id: string) => (id === 't1' ? { id: 't1', name: 'net' } : undefined),
  getParsed: async (id: string) => (id === 't1' ? parsed : undefined),
  getParseError: () => undefined,
} as unknown as TopologyService

const dashboards = {
  getByShareToken: (token: string) =>
    token === 'tok'
      ? {
          id: 'd1',
          name: 'board',
          layoutJson: JSON.stringify({ widgets: [{ config: { topologyId: 't1' } }] }),
        }
      : undefined,
} as unknown as DashboardService

const service = createShareApplicationService({
  topologies,
  dashboards,
  dataSources: {} as DataSourceService,
})

describe('a topology on a shared dashboard is served as its page serves it', () => {
  test('the view carries the scene the Server baked, beside the graph', async () => {
    const result = await service.dashboardTopology('tok', 't1', 'view')
    expect(result.ok).toBe(true)
    const value = (result as { value: { graph: unknown; scene: DrawingScene; stale: boolean } })
      .value
    expect(value.graph).toBeDefined()
    expect(value.scene.nodes.map((n) => n.node.id)).toEqual(['sw1'])
    expect(value.scene.bounds).toEqual(scene.bounds)
    expect(value.stale).toBe(false)
  })

  test('a topology the dashboard does not hold is not served', async () => {
    const result = await service.dashboardTopology('tok', 't2', 'view')
    expect(result).toMatchObject({ ok: false, status: 404 })
  })
})
