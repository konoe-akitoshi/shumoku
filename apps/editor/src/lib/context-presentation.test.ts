import { expect, test, vi } from 'vitest'

vi.mock('./state/cache.svelte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./state/cache.svelte')>()
  return { cache: { ...actual.cache, register: vi.fn(), touch: vi.fn() } }
})

import { diagramState } from './context.svelte'
import { cache } from './state/cache.svelte'

test('settings edits, undo and redo retain presentation and each schedule persistence', async () => {
  expect(diagramState.graphSettings).toBeUndefined()
  await diagramState.setGraphSettings({ direction: 'LR', legend: false })
  expect(diagramState.exportDocument().presentation.settings).toEqual({
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
  expect(diagramState.exportDocument().topology).not.toHaveProperty('settings')
  await expect(diagramState.setGraphSettings({ nodeSpacing: -1 })).rejects.toThrow()
  expect(diagramState.graphSettings).toEqual({ direction: 'LR', legend: false })
  expect(cache.touch).toHaveBeenCalledTimes(3)
})

test('reload reconstructs nested group bounds for fully positioned nodes without moving them', async () => {
  await diagramState.loadProject('fixture', {
    version: 4,
    name: 'Fixture',
    products: [],
    diagram: {
      version: '1',
      settings: { direction: 'RL' },
      nodes: [
        {
          id: 'a',
          label: 'A',
          parent: 'inner',
          position: { x: 100, y: 200 },
          size: { width: 100, height: 80 },
        },
      ],
      links: [],
      subgraphs: [
        { id: 'inner', label: 'Inner', parent: 'outer' },
        { id: 'outer', label: 'Outer' },
      ],
    },
  })
  expect(diagramState.nodes.get('a')?.position).toEqual({ x: 100, y: 200 })
  expect(diagramState.subgraphs.get('inner')?.bounds).toBeDefined()
  expect(diagramState.subgraphs.get('outer')?.bounds).toBeDefined()
  expect(
    diagramState
      .exportDocument()
      .topology.subgraphs?.every((group) => !Object.hasOwn(group, 'bounds')),
  ).toBe(true)
  await diagramState.setGraphSettings({ direction: 'BT' })
  const outer = diagramState.subgraphs.get('outer')?.bounds
  if (!outer) throw new Error('Missing derived bounds')
  expect(diagramState.bounds.x).toBeLessThanOrEqual(outer.x)
  expect(diagramState.bounds.y + diagramState.bounds.height).toBeGreaterThanOrEqual(
    outer.y + outer.height,
  )
  expect(diagramState.nodes.get('a')?.position).toEqual({ x: 100, y: 200 })
})
