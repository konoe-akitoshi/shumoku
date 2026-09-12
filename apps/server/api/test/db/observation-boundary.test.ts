import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { buildGraph } from '../../src/services/contribution-store.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let temp: TempDb
let observations: ObservationsService
let topologies: TopologyService
beforeAll(() => {
  temp = setupTempDb()
  observations = new ObservationsService()
  topologies = new TopologyService()
})
afterAll(() => temp.teardown())

describe('raw observation and canonical contribution', () => {
  test('preserves raw history, retains last-good on invalid input, and still retracts on valid empty', async () => {
    const topology = await topologies.create({ name: 'boundary' })
    const source = insertDataSource('manual', 'boundary-source')
    attachSource(topology.id, source, 'topology')
    const raw = { nodes: [{ id: 'a', upstream: 'kept' }], links: [], extra: { revision: 7 } }
    const base = { topologyId: topology.id, sourceId: source, status: 'ok' as const }
    const good = await observations.record({ ...base, capturedAt: 1, graph: raw })
    expect(good.status).toBe('ok')
    expect(good.graph).toEqual(raw)
    expect(observations.get(good.id)?.graph).toEqual(raw)
    expect(buildGraph(topology.id, source)).toMatchObject({
      version: '1',
      nodes: [{ id: 'a', label: 'a', upstream: 'kept' }],
      extra: { revision: 7 },
    })
    const before = buildGraph(topology.id, source)
    const badRaw = { nodes: [{ id: 'a', ports: { secret: 'do-not-log' } }], links: [] }
    const bad = await observations.record({ ...base, capturedAt: 2, graph: badRaw })
    expect(bad.status).toBe('failed')
    expect(bad.statusMessage).toContain('nodes.0.ports')
    expect(bad.statusMessage).not.toContain('do-not-log')
    expect(bad.contributionChanged).toBe(false)
    expect(observations.get(bad.id)?.graph).toEqual(badRaw)
    expect(observations.latestPerSource(topology.id)[0]?.status).toBe('failed')
    expect(buildGraph(topology.id, source)).toEqual(before)
    expect(observations.getContributionGraph(topology.id, source)?.nodes[0]?.id).toBe('a')
    const empty = await observations.record({
      ...base,
      capturedAt: 3,
      graph: { nodes: [], links: [] },
      status: 'empty',
    })
    expect(empty.contributionChanged).toBe(true)
    expect(buildGraph(topology.id, source)?.nodes).toEqual([])
  })

  test('opaque records are accepted as failed audit data even before a source is attached', async () => {
    const topology = await topologies.create({ name: 'opaque' })
    const source = insertDataSource('manual', 'opaque-source')
    const graph = { nodes: [{ vendorOnly: true }], links: [{}] }
    const result = await observations.record({
      topologyId: topology.id,
      sourceId: source,
      capturedAt: 1,
      status: 'ok',
      graph,
    })
    expect(result.status).toBe('failed')
    expect(result.graph).toEqual(graph)
    expect(result.contributionChanged).toBe(false)
    expect(result.portCount).toBe(0)
    expect(observations.get(result.id)?.graph).toEqual(graph)
  })
})
