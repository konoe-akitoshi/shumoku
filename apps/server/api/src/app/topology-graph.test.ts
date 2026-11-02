import type { DrawingScene, MetricsMapping } from '@shumoku/core'
import { expect, test } from 'vitest'
import { applyMappingBandwidthToScene } from './topology-graph.js'

const scene = {
  nodes: [],
  groups: [],
  wires: [
    { link: { id: 'a', from: { node: 'x' }, to: { node: 'y' } } },
    { link: { id: 'b', from: { node: 'x' }, to: { node: 'z' } } },
  ],
} as unknown as DrawingScene

test('a mapped bandwidth override lands on the scene link it names, and only there', () => {
  const mapping = { nodes: {}, links: { a: { bandwidth: 1e9 } } } as unknown as MetricsMapping
  const out = applyMappingBandwidthToScene(scene, mapping)
  expect(out.wires[0]?.link.bandwidth).toBe(1e9)
  expect(out.wires[1]?.link.bandwidth).toBeUndefined()
  expect(scene.wires[0]?.link.bandwidth).toBeUndefined()
})

test('without an override the scene is returned as it was', () => {
  expect(applyMappingBandwidthToScene(scene, undefined)).toBe(scene)
  const none = { nodes: {}, links: { a: {} } } as unknown as MetricsMapping
  expect(applyMappingBandwidthToScene(scene, none)).toBe(scene)
})
