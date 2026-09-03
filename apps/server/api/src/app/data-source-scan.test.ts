import type { DataSourcePlugin, Snapshot } from '@shumoku/core'
import { describe, expect, it, vi } from 'vitest'
import type { DataSourceService } from '../services/datasource.js'
import type { ObservationsService, TopologyObservation } from '../services/observations.js'
import type { TopologyService } from '../services/topology.js'
import { createDataSourceScanService } from './data-source-scan.js'

const snapshot: Snapshot = {
  status: 'ok',
  capturedAt: 100,
  graph: { name: 'Scan', nodes: [], links: [] },
}

function plugin(): DataSourcePlugin & { scan: () => Promise<Snapshot> } {
  return {
    type: 'scanner',
    displayName: 'Scanner',
    capabilities: ['autoscan'],
    initialize: vi.fn(),
    testConnection: vi.fn(async () => ({ success: true, message: 'Connected' })),
    scan: vi.fn(async () => snapshot),
  }
}

describe('data source scan service', () => {
  it('returns a preview without writing an observation', async () => {
    const dataSources = { getPlugin: vi.fn(() => plugin()) } as unknown as DataSourceService
    const observations = {
      record: vi.fn(),
      updateHysteresis: vi.fn(),
    } as unknown as ObservationsService
    const topologies = {
      clearCacheEntry: vi.fn(),
      precompute: vi.fn(),
    } as unknown as TopologyService
    const service = createDataSourceScanService(dataSources, observations, topologies)

    await expect(service.scan('source-1', { seeds: ['192.0.2.1'] })).resolves.toEqual({
      ok: true,
      snapshot,
    })
    expect(observations.record).not.toHaveBeenCalled()
  })

  it('persists a topology-scoped scan and refreshes changed topology state', async () => {
    const observation: TopologyObservation = {
      id: 'observation-1',
      topologyId: 'topology-1',
      sourceId: 'source-1',
      capturedAt: 100,
      status: 'ok',
      graph: snapshot.graph,
      nodeCount: 0,
      linkCount: 0,
      portCount: 0,
      createdAt: 100,
      contributionChanged: true,
    }
    const dataSources = { getPlugin: vi.fn(() => plugin()) } as unknown as DataSourceService
    const observations = {
      record: vi.fn(async () => observation),
      updateHysteresis: vi.fn(),
    } as unknown as ObservationsService
    const topologies = {
      clearCacheEntry: vi.fn(),
      precompute: vi.fn(),
    } as unknown as TopologyService
    const service = createDataSourceScanService(dataSources, observations, topologies)

    await expect(
      service.scan('source-1', { topologyId: 'topology-1', seeds: [] }),
    ).resolves.toMatchObject({ ok: true, snapshot, observation })
    expect(observations.updateHysteresis).toHaveBeenCalledWith('topology-1', 'source-1', 'ok', 100)
    expect(topologies.clearCacheEntry).toHaveBeenCalledWith('topology-1')
    expect(topologies.precompute).toHaveBeenCalledWith('topology-1')
  })
})
