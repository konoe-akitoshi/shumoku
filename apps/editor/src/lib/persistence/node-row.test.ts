import { describe, expect, it } from 'vitest'
import { decodeNodeRow, encodeNodeRow } from './node-row'

describe('node persistence row', () => {
  it('moves geometry outside the topology payload and restores it after JSON storage', () => {
    const node = {
      id: 'a',
      label: 'Router',
      position: { x: 10, y: 20 },
      size: { width: 200, height: 80 },
      metadata: { location: 'Building A' },
    }
    const before = structuredClone(node)
    const row = encodeNodeRow('project', node.id, node)
    expect(row.data).not.toHaveProperty('position')
    expect(row.data).not.toHaveProperty('size')
    expect(row.presentation).toEqual({ nodeId: 'a', position: node.position, size: node.size })
    expect(decodeNodeRow(JSON.parse(JSON.stringify(row)))).toEqual(node)
    expect(node).toEqual(before)
  })

  it('changes only the presentation payload on move/resize and restores it on undo', () => {
    const original = { id: 'a', label: 'A', position: { x: 10, y: 20 } }
    const row = encodeNodeRow('project', 'a', original)
    const moved = encodeNodeRow('project', 'a', {
      ...original,
      position: { x: 500, y: 600 },
      size: { width: 150, height: 80 },
    })
    expect(moved.data).toEqual(row.data)
    expect(moved.presentation).not.toEqual(row.presentation)
    expect(encodeNodeRow('project', 'a', decodeNodeRow(row))).toEqual(row)
    expect(decodeNodeRow(moved).position).toEqual({ x: 500, y: 600 })
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
    ).toThrow('Node geometry ID')
  })
})
