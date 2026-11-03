import { describe, expect, it } from 'vitest'
import { diagramTitle, labelText, linkTitle, nodeContentScale } from './diagram-presentation.js'

describe('what a title says', () => {
  it('keeps every fact, address and multiline detail in the title', () => {
    const node = {
      label: 'Router',
      annotations: [
        { kind: 'address' as const, label: 'Users', value: '10.0.0.12' },
        { kind: 'note' as const, label: 'Description', value: 'First line\nSecond line' },
        { kind: 'detail' as const, label: 'Cable', value: 'om4 3m' },
      ],
    }
    const title = diagramTitle(node)
    expect(title.split('\n')[0]).toBe('Router')
    expect(title).toContain('Users: 10.0.0.12')
    expect(title).toContain('First line\nSecond line')
    expect(title).toContain('Cable: om4 3m')
  })

  it('names a link by its ends, its VLANs and what it says', () => {
    const title = linkTitle({
      from: { node: 'a', port: 'p1' },
      to: { node: 'b' },
      vlan: [20, 30],
      label: 'Branch',
    })
    expect(title).toBe('a:p1 ↔ b\nVLAN 20, 30\nBranch')
  })
})

describe('what a label is', () => {
  it('drops the markup a label may carry', () => {
    expect(labelText('<b>Core</b><br/>1')).toBe('Core1')
  })

  it('keeps content inside a circle within its inscribed square', () => {
    expect(nodeContentScale('circle').x).toBeCloseTo(Math.SQRT1_2)
    expect(nodeContentScale()).toEqual({ x: 1, y: 1 })
  })
})
