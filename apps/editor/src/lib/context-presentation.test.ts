import { expect, test, vi } from 'vitest'

vi.mock('./state/cache.svelte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./state/cache.svelte')>()
  return { cache: { ...actual.cache, register: vi.fn(), touch: vi.fn() } }
})

import { diagramState } from './context.svelte'
import { cache } from './state/cache.svelte'
import { NETED_FORMAT_VERSION } from './types'

test('settings edits, undo and redo retain presentation and each schedule persistence', async () => {
  expect(diagramState.graphSettings).toBeUndefined()
  await diagramState.setGraphSettings({ direction: 'LR', legend: false })
  expect(diagramState.exportModel().drawing?.settings).toEqual({
    direction: 'LR',
    legend: false,
  })
  expect(cache.touch).toHaveBeenCalledTimes(1)
  expect(diagramState.undo()).toBe(true)
  expect(diagramState.graphSettings).toBeUndefined()
  expect(cache.touch).toHaveBeenCalledTimes(2)
  expect(diagramState.redo()).toBe(true)
  expect(diagramState.graphSettings).toEqual({ direction: 'LR', legend: false })
  expect(cache.touch).toHaveBeenCalledTimes(3)
  expect(diagramState.exportModel().config).not.toHaveProperty('settings')
  await expect(diagramState.setGraphSettings({ nodeSpacing: -1 })).rejects.toThrow()
  expect(diagramState.graphSettings).toEqual({ direction: 'LR', legend: false })
  expect(cache.touch).toHaveBeenCalledTimes(3)
})

test('reload keeps nested groups and the order hints a drag left, and stores no coordinates', async () => {
  await diagramState.loadProject('fixture', {
    version: NETED_FORMAT_VERSION,
    name: 'Fixture',
    products: [],
    model: {
      config: {
        groups: [{ id: 'outer', label: 'Outer', groups: [{ id: 'inner', label: 'Inner' }] }],
        nodes: [
          { id: 'a', label: 'A', group: 'inner' },
          { id: 'b', label: 'B', group: 'inner' },
        ],
        links: [],
      },
      drawing: { settings: { direction: 'RL' }, order: { inner: ['a', 'b'], gone: ['x', 'y'] } },
    },
  })
  expect(diagramState.nodes.get('a')?.parent).toBe('inner')
  expect(diagramState.subgraphs.get('inner')?.parent).toBe('outer')
  // A hint naming nothing in the diagram stays stored: the engine ignores it, and it comes back
  // with what it names.
  expect(diagramState.model.drawing?.order).toEqual({ inner: ['a', 'b'], gone: ['x', 'y'] })
  const drawn = diagramState.exportModel().drawing
  expect(Object.values(drawn?.groups ?? {}).every((g) => !Object.hasOwn(g, 'bounds'))).toBe(true)

  // A drop that changed only the order writes the order and nothing of the configuration.
  diagramState.applyDrop('a', 'node', { order: { inner: ['b', 'a'], gone: ['x', 'y'] } })
  expect(diagramState.nodes.get('a')?.parent).toBe('inner')
  expect(diagramState.exportModel().drawing?.order).toEqual({ inner: ['b', 'a'], gone: ['x', 'y'] })
  expect(diagramState.undoLabel).toBe('Move')

  // Dropping `a` to the top level moves it out of its group (a configuration edit) and re-keys
  // the order.
  diagramState.applyDrop('a', 'node', {
    parent: { to: undefined },
    order: { '': ['a', 'outer'], gone: ['x', 'y'] },
  })
  expect(diagramState.nodes.get('a')?.parent).toBeUndefined()
  expect(diagramState.exportModel().drawing?.order).toEqual({
    '': ['a', 'outer'],
    gone: ['x', 'y'],
  })
  expect(diagramState.exportModel().config.nodes.find((n) => n.id === 'a')?.group).toBeUndefined()
  expect(diagramState.undo()).toBe(true)
  expect(diagramState.undo()).toBe(true)
  expect(diagramState.nodes.get('a')?.parent).toBe('inner')
  expect(diagramState.exportModel().drawing?.order).toEqual({
    inner: ['a', 'b'],
    gone: ['x', 'y'],
  })
})
