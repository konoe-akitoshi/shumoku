import { readNetworkModel } from '@shumoku/core'
import { expect, test, vi } from 'vitest'

vi.mock('./state/cache.svelte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./state/cache.svelte')>()
  return { cache: { ...actual.cache, register: vi.fn(), touch: vi.fn() } }
})

import { diagramState } from './context.svelte'
import { NETED_FORMAT_VERSION } from './types'

const yaml = `
routingDomains:
  - id: internet
nodes:
  - id: core
    label: Core
    type: l3-switch
    product: Cisco/Catalyst/C9300
    software: IOS-XE 17.9
  - id: edge
    type: router
  - id: vm
    type: server
    host: edge
links:
  - id: uplink
    endpoints: [{ node: core, port: ge-1 }, { node: edge, port: ge-0 }]
    speed: 2.5G
    description: to the edge
  - endpoints: [{ node: edge }, { routingDomain: internet }]
`

async function load() {
  await diagramState.loadProject('model', {
    version: NETED_FORMAT_VERSION,
    name: 'Model',
    products: [],
    model: readNetworkModel(yaml),
  })
}

test('the editor keeps what the YAML says beyond the diagram across edits', async () => {
  await load()
  // Layout placed every node; positions went to the drawing layer, not the configuration.
  const loaded = diagramState.exportModel()
  expect(loaded.drawing?.nodes?.core?.position).toBeDefined()
  expect(loaded.config.nodes.find((n) => n.id === 'core')).toEqual({
    id: 'core',
    label: 'Core',
    type: 'l3-switch',
    product: 'Cisco/Catalyst/C9300',
    software: 'IOS-XE 17.9',
  })

  diagramState.updateNode('core', { label: 'Core 1', position: { x: 5, y: 6 } })
  const edited = diagramState.exportModel()
  expect(edited.config.nodes.find((n) => n.id === 'core')).toMatchObject({
    label: 'Core 1',
    product: 'Cisco/Catalyst/C9300',
    software: 'IOS-XE 17.9',
  })
  expect(edited.drawing?.nodes?.core?.position).toEqual({ x: 5, y: 6 })
  expect(edited.config.nodes.find((n) => n.id === 'vm')?.host).toBe('edge')
  expect(edited.config.routingDomains).toEqual([{ id: 'internet' }])
  expect(edited.config.links.find((l) => l.id === 'uplink')).toMatchObject({
    speed: '2.5G',
    description: 'to the edge',
  })
  // The routing domain's link is not drawn, but stays in the configuration.
  expect(edited.config.links.some((l) => l.endpoints[1] && 'routingDomain' in l.endpoints[1])).toBe(
    true,
  )
})

test('undo restores the model, and removing a node drops what referred to it', async () => {
  await load()
  diagramState.removeNode('edge')
  const removed = diagramState.exportModel()
  expect(removed.config.nodes.map((n) => n.id)).toEqual(['core', 'vm'])
  expect(removed.config.nodes.find((n) => n.id === 'vm')?.host).toBeUndefined()
  expect(diagramState.undo()).toBe(true)
  const restored = diagramState.exportModel()
  expect(restored.config.nodes.find((n) => n.id === 'vm')?.host).toBe('edge')
  expect(diagramState.nodes.has('edge')).toBe(true)
})

test('editing the YAML replaces the configuration and keeps the layers of the ids it has', async () => {
  await load()
  const position = diagramState.exportModel().drawing?.nodes?.core?.position
  const next = readNetworkModel(
    `${yaml}\n  - id: extra\n    endpoints: [{ node: core }, { node: vm }]\n`,
  )
  await diagramState.replaceModel({ ...diagramState.model, config: next.config })
  const model = diagramState.exportModel()
  expect(model.config.links.some((l) => l.id === 'extra')).toBe(true)
  expect(model.drawing?.nodes?.core?.position).toEqual(position)
  expect(diagramState.links.some((l) => l.id === 'extra')).toBe(true)
})
