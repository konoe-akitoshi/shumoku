import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { resolveNetwork } from './resolve-network.js'

describe('resolveNetwork places a hosted node by its host', () => {
  it('gives a node with a winning host no group, even when a source placed it', () => {
    const project = readNetworkModel('nodes:\n  - { id: h1 }\nlinks: []\n')
    const out = resolveNetwork(project, [
      {
        sourceId: 'src',
        capturedAt: 1,
        status: 'ok',
        source: {
          network: {
            groups: [{ id: 'dc' }],
            nodes: [
              { id: 'sh', group: 'dc' },
              { id: 'sv', group: 'dc', host: 'sh' },
            ],
            links: [],
          },
        },
      },
    ])
    const nodes = out.config.nodes
    const vm = nodes.find((n) => n.host !== undefined)
    expect(vm).toBeDefined()
    expect(vm?.group).toBeUndefined()
    expect(nodes.find((n) => n.host === undefined && n.group !== undefined)).toBeDefined()
  })
})
