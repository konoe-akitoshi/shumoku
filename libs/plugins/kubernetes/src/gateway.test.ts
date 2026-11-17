import { checkNetwork, drawNetwork, resolveNetwork } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { testMetrics } from '../../../@shumoku/core/src/drawing/testing/support.js'
import { addGatewayTopology } from './gateway.js'
import { buildTopology } from './topology.js'
import type { Inventory } from './types.js'
import { buildWorkloadTopology } from './workloads.js'

const metadata = (uid: string, namespace = 'demo') => ({ uid, name: uid, namespace, generation: 2 })
function fixture(): Inventory {
  return {
    nodes: [],
    pods: [],
    slices: [],
    services: [{ metadata: metadata('web') }],
    gateways: [
      {
        metadata: metadata('edge'),
        spec: {
          gatewayClassName: 'example',
          listeners: [{ name: 'https', port: 443, protocol: 'HTTPS' }],
        },
        status: { conditions: [{ type: 'Programmed', status: 'True', observedGeneration: 2 }] },
      },
    ],
    routes: [
      {
        metadata: metadata('route'),
        spec: {
          hostnames: ['app.example.com'],
          parentRefs: [{ name: 'edge', sectionName: 'https' }],
          rules: [
            {
              matches: [{ path: { type: 'PathPrefix', value: '/api' } }],
              backendRefs: [{ name: 'web', port: 80, weight: 0 }],
            },
          ],
        },
        status: {
          parents: [
            {
              parentRef: { name: 'edge', sectionName: 'https' },
              controllerName: 'example/controller',
              conditions: [
                {
                  type: 'Accepted',
                  status: 'False',
                  reason: 'NotAllowedByListeners',
                  observedGeneration: 2,
                },
              ],
            },
          ],
        },
      },
    ],
    grants: [],
  }
}
describe('Gateway API map', () => {
  it('renders configured references in both views, preserving rejected attachments and zero weight', () => {
    for (const build of [buildTopology, buildWorkloadTopology]) {
      const inventory = fixture()
      const base = build(inventory)
      const original = JSON.stringify(base)
      const result = addGatewayTopology(base, inventory)
      expect(JSON.stringify(base)).toBe(original)
      expect(checkNetwork(result.network)).toEqual([])
      expect(result.network.links).toHaveLength(2)
      expect(result.network.links[0]?.description).toContain('Accepted=False')
      expect(result.network.links[1]?.description).toContain('weight 0 (disabled)')
      const { model } = resolveNetwork({ network: { nodes: [], links: [] } }, [
        { sourceId: 'k8s', status: 'ok', capturedAt: 1, source: result },
      ])
      expect(drawNetwork(model, { metrics: () => testMetrics }).nodes).toHaveLength(3)
      expect(result.observation?.nodes?.['k8s:route']?.metadata?.['Matches']).toEqual([
        { Rule: 'rule 1', Method: '*', 'Path type': 'PathPrefix', Path: '/api' },
      ])
    }
  })
  it('marks stale and missing controller status without claiming acceptance', () => {
    const inventory = fixture()
    const route = inventory.routes?.[0]
    if (!route) throw new Error('fixture')
    route.status = {
      parents: [
        {
          parentRef: { name: 'edge', sectionName: 'https' },
          controllerName: 'example',
          conditions: [{ type: 'Accepted', status: 'True', observedGeneration: 1 }],
        },
      ],
    }
    expect(
      addGatewayTopology(buildTopology(inventory), inventory).network.links[0]?.description,
    ).toContain('stale')
    route.status = undefined
    expect(
      addGatewayTopology(buildTopology(inventory), inventory).network.links[0]?.description,
    ).toContain('Unknown')
  })
  it('requires an exact cross-namespace ReferenceGrant and does not guess missing targets', () => {
    const inventory = fixture()
    inventory.services = [{ metadata: metadata('web', 'backend') }]
    const rule = inventory.routes?.[0]?.spec?.rules?.[0]
    if (!rule) throw new Error('fixture')
    rule.backendRefs = [{ name: 'web', namespace: 'backend', port: 80 }]
    const result = () => addGatewayTopology(buildTopology(inventory), inventory)
    expect(result().network.links).toHaveLength(1)
    inventory.grants = [
      {
        metadata: metadata('grant', 'backend'),
        spec: {
          from: [{ group: 'gateway.networking.k8s.io', kind: 'HTTPRoute', namespace: 'demo' }],
          to: [{ group: '', kind: 'Service', name: 'other' }],
        },
      },
    ]
    expect(result().network.links).toHaveLength(1)
    const grant = inventory.grants[0]
    if (!grant?.spec) throw new Error('fixture')
    grant.spec.to = [{ group: '', kind: 'Service', name: 'web' }]
    expect(result().network.links).toHaveLength(2)
    inventory.services = []
    expect(result().network.links).toHaveLength(1)
  })
  it('keeps unresolved and unsupported references in details, without inventing nodes', () => {
    const inventory = fixture()
    const route = inventory.routes?.[0]
    if (!route?.spec) throw new Error('fixture')
    route.spec.parentRefs = [{ name: 'edge', kind: 'Service', group: '' }, { name: 'missing' }]
    route.spec.rules = [{ backendRefs: [{ name: 'web', group: 'custom', kind: 'CustomBackend' }] }]
    const result = addGatewayTopology(buildTopology(inventory), inventory)
    expect(result.network.links).toEqual([])
    expect(result.network.nodes).toHaveLength(3)
    expect(JSON.stringify(result.observation)).toContain('Unsupported backend kind')
    expect(JSON.stringify(result.observation)).toContain('Not found in selected scope')
  })
})
