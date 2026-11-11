import { describe, expect, it } from 'vitest'
import { normalizeObservationSource } from './observation-graph.js'

describe('observation boundary', () => {
  it('accepts a source in the configuration shape and keeps extension fields', () => {
    const raw = {
      upstream: { revision: 7 },
      network: {
        nodes: [
          {
            id: 'a',
            address: '10.0.0.1',
            sysName: 'core-1',
            vendorField: true,
            ports: [{ name: 'eth0', mac: 'aa:bb:cc:dd:ee:ff', vendorPort: 4 }],
          },
          { id: 'b' },
        ],
        links: [{ endpoints: [{ node: 'a', port: 'eth0' }, { node: 'b' }], vendorLink: 'x' }],
      },
      observation: {
        nodes: { a: { vendorIds: { 'src-id': '1' }, ports: { eth0: { ifIndex: 3 } } } },
      },
    }
    const before = structuredClone(raw)
    const result = normalizeObservationSource(raw)
    if (!result.success) throw result.error
    expect(result.data.network.nodes[0]).toMatchObject({ id: 'a', address: '10.0.0.1' })
    expect(result.data.observation?.nodes?.['a']?.vendorIds).toEqual({ 'src-id': '1' })
    expect(result.data).toMatchObject({ upstream: { revision: 7 } })
    expect(raw).toEqual(before)
  })

  it('refuses the identity field of the shape sources had before the attributes moved', () => {
    const result = normalizeObservationSource({
      network: { nodes: [{ id: 'a' }], links: [] },
      observation: { nodes: { a: { identity: { mgmtIp: '10.0.0.1' } } } },
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['observation', 'nodes', 'a', 'identity'])
    expect(result.error.issues[0]?.message).toContain('address')
  })

  it('strips script-bearing inline icons from an untrusted source (GHSA icon XSS)', () => {
    const icon = '<image href="x" onerror="window.__xss=1" /><path d="M1 1"/>'
    const result = normalizeObservationSource({
      network: { nodes: [{ id: 'evil' }], links: [], groups: [{ id: 'g' }] },
      drawing: {
        nodes: { evil: { icon } },
        groups: { g: { spec: { kind: 'hardware', type: 'l2-switch', icon } } },
      },
    })
    expect(result.success).toBe(true)
    if (!result.success) throw result.error
    const nodeIcon = result.data.drawing?.nodes?.['evil']?.icon ?? ''
    const groupIcon = result.data.drawing?.groups?.['g']?.spec?.icon ?? ''
    for (const out of [nodeIcon, groupIcon]) {
      expect(out).not.toMatch(/onerror/i)
      // Benign drawing markup in the same icon survives.
      expect(out).toContain('<path')
    }
  })

  it('keeps a URL icon untouched', () => {
    const result = normalizeObservationSource({
      network: { nodes: [{ id: 'a' }], links: [] },
      drawing: { nodes: { a: { icon: 'https://cdn.example/icon.svg' } } },
    })
    expect(result.success).toBe(true)
    if (!result.success) throw result.error
    expect(result.data.drawing?.nodes?.['a']?.icon).toBe('https://cdn.example/icon.svg')
  })

  it.each([
    { network: { nodes: [{}], links: [] } },
    { network: { nodes: [{ id: 'a', ports: {} }], links: [] } },
    { network: { nodes: [{ id: 'a', ports: [{ name: '' }] }], links: [] } },
    { network: { nodes: [{ id: 'a', mac: 4 }], links: [] } },
    { network: { nodes: [], links: [{}] } },
    { network: { nodes: [], links: [{ endpoints: [{ node: 'a' }] }] } },
    {
      network: { nodes: [{ id: 'a' }], links: [] },
      observation: { nodes: { a: { vendorIds: { netbox: {} } } } },
    },
    {
      network: { nodes: [{ id: 'a' }], links: [] },
      observation: { nodes: { a: { attachments: [null] } } },
    },
    {
      network: { nodes: [{ id: 'a' }], links: [] },
      observation: { nodes: { a: { ports: { p: { ifIndex: 'x' } } } } },
    },
    {
      network: { nodes: [], links: [] },
      drawing: { settings: { canvas: { width: 'bad' } } },
    },
  ])('rejects unsafe canonical data: %j', (source) => {
    expect(normalizeObservationSource(source).success).toBe(false)
  })
})
