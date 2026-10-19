import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { buildNetwork } from '../../src/services/contribution-store.ts'
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
    const raw = {
      network: { name: 'raw', nodes: [{ id: 'a', label: 'a', upstream: 'kept' }], links: [] },
      observation: { nodes: { a: { identity: { sysName: 'a' }, metadata: { revision: 7 } } } },
      extra: { revision: 7 },
    }
    const base = { topologyId: topology.id, sourceId: source, status: 'ok' as const }
    const good = await observations.record({ ...base, capturedAt: 1, source: raw })
    expect(good.status).toBe('ok')
    expect(good.source).toEqual(raw)
    expect(observations.get(good.id)?.source).toEqual(raw)
    expect(buildNetwork(topology.id, source)).toMatchObject({
      network: { name: 'raw', nodes: [{ id: 'a', label: 'a', upstream: 'kept' }] },
      observation: { nodes: { a: { identity: { sysName: 'a' }, metadata: { revision: 7 } } } },
    })
    const before = buildNetwork(topology.id, source)
    const badRaw = {
      network: { nodes: [{ id: 'a' }], links: [] },
      observation: { nodes: { a: { identity: { ifIndex: 'do-not-log' } } } },
    }
    const bad = await observations.record({ ...base, capturedAt: 2, source: badRaw })
    expect(bad.status).toBe('failed')
    expect(bad.statusMessage).toContain('observation.nodes.a.identity.ifIndex')
    expect(bad.statusMessage).not.toContain('do-not-log')
    expect(bad.contributionChanged).toBe(false)
    expect(observations.get(bad.id)?.source).toEqual(badRaw)
    expect(observations.latestPerSource(topology.id)[0]?.status).toBe('failed')
    expect(buildNetwork(topology.id, source)).toEqual(before)
    expect(observations.getContribution(topology.id, source)?.network.nodes[0]?.id).toBe('a')
    const empty = await observations.record({
      ...base,
      capturedAt: 3,
      source: { network: { nodes: [], links: [] } },
      status: 'empty',
    })
    expect(empty.contributionChanged).toBe(true)
    expect(buildNetwork(topology.id, source)?.network.nodes).toEqual([])
  })

  test('opaque records are accepted as failed audit data even before a source is attached', async () => {
    const topology = await topologies.create({ name: 'opaque' })
    const source = insertDataSource('manual', 'opaque-source')
    const raw = { network: { nodes: [{ vendorOnly: true }], links: [{}] } }
    const result = await observations.record({
      topologyId: topology.id,
      sourceId: source,
      capturedAt: 1,
      status: 'ok',
      source: raw,
    })
    expect(result.status).toBe('failed')
    expect(result.source).toEqual(raw)
    expect(result.contributionChanged).toBe(false)
    expect(result.portCount).toBe(0)
    expect(observations.get(result.id)?.source).toEqual(raw)
  })

  test('a script-bearing inline icon is sanitized before it reaches the contribution', async () => {
    const topology = await topologies.create({ name: 'icon' })
    const source = insertDataSource('manual', 'icon-source')
    attachSource(topology.id, source, 'topology')
    const raw = {
      network: { nodes: [{ id: 'a' }], links: [] },
      drawing: {
        nodes: {
          a: {
            icon: '<svg xmlns="http://www.w3.org/2000/svg" onload="evil()"><script>evil()</script></svg>',
          },
        },
      },
    }
    const result = await observations.record({
      topologyId: topology.id,
      sourceId: source,
      capturedAt: 1,
      status: 'ok',
      source: raw,
    })
    expect(result.status).toBe('ok')
    const icon = buildNetwork(topology.id, source)?.drawing?.nodes?.['a']?.icon
    expect(icon).toBeDefined()
    expect(icon).not.toContain('<script')
    expect(icon).not.toContain('onload')
  })
})
