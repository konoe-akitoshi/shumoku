import { sampleNetwork, YamlParser } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { normalizeObservationGraph } from './observation-graph.js'

describe('observation graph boundary', () => {
  it.each(sampleNetwork)('accepts the parsed core fixture $name', (file) => {
    const graph = new YamlParser().parse(file.content).graph
    const result = normalizeObservationGraph(graph)
    if (!result.success) throw result.error
    expect(result.data.nodes).toHaveLength(graph.nodes.length)
    expect(result.data.links).toHaveLength(graph.links.length)
  })
  it('fills legacy defaults without mutating raw data or dropping extension fields', () => {
    const raw = {
      upstream: { revision: 7 },
      nodes: [{ id: 'a', vendorField: true, ports: [{ id: 'eth0', vendorPort: 4 }] }, { id: 'b' }],
      links: [{ from: { node: 'a' }, to: { node: 'b' }, vendorLink: 'x' }],
    }
    const before = structuredClone(raw)
    const result = normalizeObservationGraph(raw)
    expect(result.success).toBe(true)
    if (!result.success) throw result.error
    expect(result.data.version).toBe('1')
    expect(result.data.nodes[0]).toMatchObject({
      id: 'a',
      label: 'a',
      vendorField: true,
      ports: [{ id: 'eth0', label: 'eth0', connectors: [], vendorPort: 4 }],
    })
    expect(result.data.links[0]).toMatchObject({ from: { node: 'a', port: '' }, vendorLink: 'x' })
    expect(result.data.upstream).toEqual({ revision: 7 })
    expect(raw).toEqual(before)
  })

  it.each([
    { nodes: [{}], links: [] },
    { nodes: [{ id: 'a', ports: {} }], links: [] },
    { nodes: [{ id: 'a', ports: [null] }], links: [] },
    { nodes: [{ id: 'a', identity: { vendorIds: { netbox: {} } } }], links: [] },
    { nodes: [{ id: 'a', attachments: [null] }], links: [] },
    { nodes: [{ id: 'a', suppressedAttachments: [4] }], links: [] },
    { nodes: [{ id: 'a', spec: { kind: 'hardware', type: [] } }], links: [] },
    { nodes: [{ id: 'a', ports: [{ id: 'p', connectors: 4 }] }], links: [] },
    { nodes: [], links: [{}] },
    { nodes: [], links: [{ from: null, to: { node: 'a' } }] },
    { nodes: [], links: [], settings: { canvas: { width: 'bad' } } },
    { nodes: [{ id: 'a' }, { id: 'a' }], links: [] },
    { nodes: [{ id: 'a', parent: 'missing' }], links: [] },
    {
      nodes: [],
      links: [],
      subgraphs: [
        { id: 'a', parent: 'b' },
        { id: 'b', parent: 'a' },
      ],
    },
    { nodes: [{ id: 'a', ports: [{ id: 'p' }, { id: 'p' }] }], links: [] },
    { nodes: [{ id: '__exclusion_0' }], links: [] },
    { nodes: [], links: [{ from: { node: 'a' }, to: { node: 'b' }, via: ['missing'] }] },
  ])('rejects unsafe canonical data: %j', (graph) => {
    expect(normalizeObservationGraph(graph).success).toBe(false)
  })
})
