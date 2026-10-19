import { describe, expect, it } from 'vitest'
import { createEngine } from '../layout/engine/index.js'
import {
  diagramTitle,
  linkLabelSize,
  linkPresentationLines,
  nodePresentation,
} from './diagram-presentation.js'
import type { Node } from './types.js'

describe('diagram information hierarchy', () => {
  const node: Node = {
    id: 'router',
    label: 'Router',
    annotations: [
      { kind: 'identity', label: 'Model', value: 'RTX3510' },
      { kind: 'identity', label: 'AS', value: 'AS65001' },
      ...Array.from({ length: 12 }, (_, i) => ({
        kind: 'address' as const,
        label: 'Users',
        value: `10.0.0.${i + 1}`,
      })),
      { kind: 'relation', label: 'Host', value: 'Production cluster' },
      { kind: 'note', label: 'Description', value: 'First line\nSecond line with full context' },
      { kind: 'detail', label: 'Cable', value: 'om4 3m' },
    ],
  }

  it('prioritizes relationships while keeping every address and multiline detail available', () => {
    const view = nodePresentation(node)
    expect(view.subtitle).toBe('RTX3510 · AS65001')
    expect(view.rows[0]).toEqual({ label: 'Host', value: 'Production cluster' })
    expect(view.rows).toHaveLength(4)
    // 12 addresses and the description do not fit; the cable detail is not counted.
    expect(view.hidden).toBe(10)
    expect(view.title).toContain('Cable: om4 3m')
    expect(view.title).toContain('10.0.0.12')
    expect(view.title).toContain('First line\nSecond line with full context')
  })

  it('does not enlarge the topology for unbounded addresses or prose', () => {
    const engine = createEngine()
    const size = engine.nodeBodySize(node)
    const bigger = engine.nodeBodySize({
      ...node,
      annotations: [
        ...(node.annotations ?? []),
        { kind: 'note', label: 'Description', value: 'long text '.repeat(1000) },
      ],
    })
    expect(bigger.height).toBe(size.height)
    expect(bigger.width).toBe(size.width)
  })

  it('shows complete IPv6 addresses and keeps content inside circular nodes', () => {
    const address = '2001:0db8:0000:0000:0000:0000:1234:5678'
    const item: Node = {
      id: 'a',
      label: 'Router',
      shape: 'circle',
      annotations: [{ kind: 'address', label: 'Address', value: address }],
    }
    expect(nodePresentation(item).rows[0]?.value).toBe(address)
    const size = createEngine().nodeBodySize(item)
    expect(size.width).toBe(size.height)
  })

  it('keeps physical details in the title and sizes the compact link caption', () => {
    const link = {
      label: 'Branch',
      vlan: [20],
      annotations: [
        { kind: 'identity' as const, label: 'Bandwidth', value: 'cap 300M' },
        { kind: 'note' as const, label: 'Description', value: 'eBGP, transit from AS64510' },
        { kind: 'detail' as const, label: 'Cable', value: 'om4 3m' },
      ],
    }
    const lines = linkPresentationLines(link)
    expect(lines).toEqual(['Branch · cap 300M', 'VLAN 20', 'eBGP, transit from AS64510'])
    expect(diagramTitle(link)).toContain('Cable: om4 3m')
    expect(linkLabelSize(lines).height).toBeGreaterThan(42)
  })

  it('shows a description in the rows when there is room', () => {
    const view = nodePresentation({
      label: 'Storage',
      annotations: [
        { kind: 'address', label: 'Address', value: '10.1.10.1' },
        { kind: 'note', label: 'Description', value: 'Backup Storage' },
      ],
    })
    expect(view.rows).toEqual([
      { label: 'Address', value: '10.1.10.1' },
      { label: 'Description', value: 'Backup Storage' },
    ])
    expect(view.hidden).toBe(0)
  })
})
