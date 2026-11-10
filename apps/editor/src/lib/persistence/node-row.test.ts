import type { Node } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { decodeNodeRow, encodeNodeRow } from './node-row'

describe('node persistence row', () => {
  it('moves appearance outside the topology payload and restores it after JSON storage', () => {
    const node: Node = {
      id: 'a',
      label: 'Router',
      metadata: { location: 'Building A' },
      shape: 'circle',
      style: { fill: '#123456', opacity: 0 },
    }
    const before = structuredClone(node)
    const row = encodeNodeRow('project', node.id, node)
    expect(row.data).not.toHaveProperty('shape')
    expect(row.data).not.toHaveProperty('style')
    expect(row.presentation).toEqual({ nodeId: 'a', shape: node.shape, style: node.style })
    expect(decodeNodeRow(JSON.parse(JSON.stringify(row)))).toEqual(node)
    expect(node).toEqual(before)
  })

  it('drops the geometry an older row kept and changes only the presentation on restyle', () => {
    const original = { id: 'a', label: 'A' }
    const row = encodeNodeRow('project', 'a', original)
    const restyled = encodeNodeRow('project', 'a', { ...original, shape: 'circle' })
    expect(restyled.data).toEqual(row.data)
    expect(restyled.presentation).not.toEqual(row.presentation)
    expect(encodeNodeRow('project', 'a', decodeNodeRow(row))).toEqual(row)
    const moved = {
      ...row,
      presentation: { nodeId: 'a', shape: 'circle' as const, position: { x: 500, y: 600 } },
    }
    expect(decodeNodeRow(moved)).toEqual({ ...original, shape: 'circle' })
  })

  it('detects inconsistent row and geometry IDs', () => {
    expect(() => encodeNodeRow('project', 'wrong', { id: 'a', label: 'A' })).toThrow('Node row ID')
    expect(() =>
      decodeNodeRow({
        projectId: 'project',
        id: 'a',
        data: { id: 'a', label: 'A' },
        presentation: { nodeId: 'wrong', position: { x: 1, y: 2 } },
      }),
    ).toThrow('Node presentation ID')
  })
})
