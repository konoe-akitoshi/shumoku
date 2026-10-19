import { deriveMappingFromGraph, type SourceNetwork, sourceToGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { bindSourceHosts } from './source-topology.js'

const source: SourceNetwork = {
  network: { nodes: [{ id: 'guid', label: 'R' }], links: [] },
  design: {
    nodes: { guid: { ports: { eth0: { label: 'eth0', interfaceName: 'eth0', connectors: [] } } } },
  },
}
describe('source instance binding', () => {
  it('binds on every sync and includes newly discovered hosts without editing the overlay', () => {
    const next: SourceNetwork = {
      ...source,
      network: { ...source.network, nodes: [...source.network.nodes, { id: 'new', label: 'new' }] },
    }
    const result = bindSourceHosts(
      next,
      [
        { id: 'guid', name: 'R', status: 'unknown' },
        { id: 'new', name: 'new', status: 'unknown' },
      ],
      'instance-one',
    )
    const graph = sourceToGraph(result)
    expect(Object.keys(deriveMappingFromGraph(graph, new Set(['instance-one'])).nodes)).toEqual([
      'guid',
      'new',
    ])
    expect(deriveMappingFromGraph(graph, new Set(['instance-two'])).nodes).toEqual({})
    expect(result.observation?.nodes?.['guid']?.ports?.['eth0']?.attachments?.[0]).toMatchObject({
      sourceId: 'instance-one',
      interfaceName: 'eth0',
    })
    expect(source.observation).toBeUndefined()
  })
  it('does not bind names, ambiguous IDs or overwrite existing bindings', () => {
    const attachmentsOf = (s: SourceNetwork) => s.observation?.nodes?.['guid']?.attachments
    expect(
      attachmentsOf(
        bindSourceHosts(source, [{ id: 'different', name: 'R', status: 'unknown' }], 's'),
      ),
    ).toBeUndefined()
    const h = { id: 'guid', name: 'R', status: 'unknown' as const }
    expect(attachmentsOf(bindSourceHosts(source, [h, h], 's'))).toBeUndefined()
    const bound = bindSourceHosts(source, [h], 's')
    expect(bindSourceHosts(bound, [h], 's')).toEqual(bound)
  })
})
