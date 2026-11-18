import type { Node } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { decodeNodeRow, encodeNodeRow } from './node-row'

describe('node persistence row', () => {
  it('stores a node as facts alone and restores it after JSON storage', () => {
    const node: Node = { id: 'a', label: 'Router' }
    const before = structuredClone(node)
    const row = encodeNodeRow('project', node.id, node)
    expect(row).not.toHaveProperty('presentation')
    expect(decodeNodeRow(JSON.parse(JSON.stringify(row)))).toEqual(node)
    expect(node).toEqual(before)
  })

  it('drops the geometry and shape an older row kept', () => {
    const original = { id: 'a', label: 'A' }
    const row = encodeNodeRow('project', 'a', original)
    expect(encodeNodeRow('project', 'a', decodeNodeRow(row))).toEqual(row)
    const moved = {
      ...row,
      presentation: { nodeId: 'a', shape: 'circle' as const, position: { x: 500, y: 600 } },
    }
    expect(decodeNodeRow(moved)).toEqual(original)
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
