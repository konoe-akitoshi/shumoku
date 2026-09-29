import { deriveMappingFromGraph, type NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { bindSourceHosts } from './source-topology.js'

const graph: NetworkGraph = {
  version: '1',
  nodes: [
    { id: 'guid', label: 'R', ports: [{ id: 'eth0', interfaceName: 'eth0', connectors: [] }] },
  ],
  links: [],
}
describe('source instance binding', () => {
  it('binds on every sync and includes newly discovered hosts without editing the overlay', () => {
    const next = { ...graph, nodes: [...graph.nodes, { id: 'new', label: 'new' }] }
    const result = bindSourceHosts(
      next,
      [
        { id: 'guid', name: 'R', status: 'unknown' },
        { id: 'new', name: 'new', status: 'unknown' },
      ],
      'instance-one',
    )
    expect(Object.keys(deriveMappingFromGraph(result, new Set(['instance-one'])).nodes)).toEqual([
      'guid',
      'new',
    ])
    expect(deriveMappingFromGraph(result, new Set(['instance-two'])).nodes).toEqual({})
    expect(result.nodes[0]?.ports?.[0]?.attachments?.[0]).toMatchObject({
      sourceId: 'instance-one',
      interfaceName: 'eth0',
    })
    expect(graph.nodes[0]?.attachments).toBeUndefined()
  })
  it('does not bind names, ambiguous IDs or overwrite existing bindings', () => {
    expect(
      bindSourceHosts(graph, [{ id: 'different', name: 'R', status: 'unknown' }], 's').nodes[0]
        ?.attachments,
    ).toBeUndefined()
    const h = { id: 'guid', name: 'R', status: 'unknown' as const }
    expect(bindSourceHosts(graph, [h, h], 's').nodes[0]?.attachments).toBeUndefined()
    const bound = bindSourceHosts(graph, [h], 's')
    expect(bindSourceHosts(bound, [h], 's')).toEqual(bound)
  })
})
