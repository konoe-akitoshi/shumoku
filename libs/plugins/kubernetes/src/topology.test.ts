import { checkNetwork, drawNetwork, readNetworkModel } from '@shumoku/core'
import { validateTopologyIdentityContract } from '@shumoku/core/plugin-kit'
import { describe, expect, it } from 'vitest'
import { testMetrics } from '../../../@shumoku/core/src/drawing/testing/support.js'
import { buildTopology } from './topology.js'
import type { Inventory, Resource } from './types.js'

const resource = (uid: string, name: string, namespace?: string): Resource => ({
  metadata: { uid, name, ...(namespace ? { namespace } : {}) },
})
function fixture(): Inventory {
  return {
    nodes: [resource('node-uid', 'worker-a')],
    pods: [
      {
        ...resource('pod-uid', 'web-1', 'demo'),
        spec: { nodeName: 'worker-a' },
        status: { phase: 'Running', podIP: '10.0.0.1' },
      },
    ],
    services: [resource('service-uid', 'web', 'demo')],
    slices: [
      {
        metadata: {
          uid: 'slice-uid',
          name: 'web-v4',
          namespace: 'demo',
          labels: { 'kubernetes.io/service-name': 'web' },
        },
        endpoints: [
          {
            targetRef: { kind: 'Pod', uid: 'pod-uid', name: 'web-1', namespace: 'demo' },
            conditions: { ready: true },
          },
        ],
      },
    ],
  }
}
describe('Kubernetes topology', () => {
  it('represents hosting separately from virtual backend links and satisfies identity contracts', () => {
    const result = buildTopology(fixture())
    expect(checkNetwork(result.network)).toEqual([])
    expect(() =>
      drawNetwork(readNetworkModel(JSON.stringify(result.network)), { metrics: () => testMetrics }),
    ).not.toThrow()
    expect(result.network.nodes.find((node) => node.id === 'k8s:pod-uid')?.host).toBe(
      'k8s:node-uid',
    )
    expect(result.network.links).toHaveLength(1)
    expect(result.network.links[0]).toMatchObject({
      virtual: true,
      endpoints: [{ node: 'k8s:service-uid' }, { node: 'k8s:pod-uid' }],
    })
    expect(
      result.network.nodes.every(
        (node) => node.address === undefined && node.sysName === undefined,
      ),
    ).toBe(true)
    expect(validateTopologyIdentityContract(result)).toEqual({
      nodesMissingIdentity: [],
      portsMissingName: [],
    })
  })
  it('deduplicates IPv4/IPv6 slices and preserves not-ready/terminating observations', () => {
    const inventory = fixture()
    const first = inventory.slices[0]
    if (!first) throw new Error('missing fixture')
    inventory.slices.push({
      ...first,
      metadata: { ...first.metadata, uid: 'slice-v6' },
      endpoints: [
        {
          targetRef: { kind: 'Pod', uid: 'pod-uid' },
          conditions: { ready: false, serving: true, terminating: true },
        },
      ],
    })
    const result = buildTopology(inventory)
    expect(result.network.links).toHaveLength(1)
    expect(
      result.observation?.links?.['backend:service-uid:pod-uid']?.metadata?.['endpointConditions'],
    ).toContain('ready=false, serving=true, terminating=true')
    expect(result.network.description).toContain('not traffic flows')
  })
  it('does not join stale UIDs, cross-namespace references or external IP endpoints', () => {
    const inventory = fixture()
    inventory.pods = [
      resource('new-pod-uid', 'web-1', 'demo'),
      resource('other-uid', 'web-1', 'other'),
    ]
    const slice = inventory.slices[0]
    if (!slice) throw new Error('missing fixture')
    slice.endpoints?.push(
      { targetRef: { kind: 'Pod', uid: 'other-uid', namespace: 'other' } },
      { targetRef: { kind: 'Pod', name: 'web-1' } },
      {},
    )
    expect(buildTopology(inventory).network.links).toEqual([])
  })
  it('keeps headless backends but does not fabricate ExternalName targets', () => {
    const inventory = fixture()
    const service = inventory.services[0]
    if (!service) throw new Error('missing fixture')
    service.spec = { clusterIP: 'None' }
    expect(buildTopology(inventory).network.links).toHaveLength(1)
    service.spec = { type: 'ExternalName', externalName: 'example.invalid' }
    expect(buildTopology(inventory).network.links).toEqual([])
    expect(
      buildTopology(inventory).network.nodes.find((node) => node.id === 'k8s:service-uid')
        ?.description,
    ).toContain('example.invalid')
  })
  it('keeps unscheduled Pods without claiming a host or a connection', () => {
    const inventory = fixture()
    inventory.pods = [resource('pending-uid', 'pending', 'demo')]
    const result = buildTopology(inventory)
    expect(result.network.nodes.find((node) => node.id === 'k8s:pending-uid')?.host).toBeUndefined()
    expect(result.network.links).toEqual([])
  })
  it('does not retain Pod environment, arguments, annotations or complete specs', () => {
    const inventory = fixture()
    const pod = {
      metadata: {
        uid: 'sensitive-pod',
        name: 'web',
        namespace: 'demo',
        annotations: { note: 'private-annotation' },
      },
      spec: {
        nodeName: 'worker-a',
        containers: [
          { args: ['private-argument'], env: [{ name: 'PASSWORD', value: 'private-value' }] },
        ],
      },
    }
    inventory.pods.push(pod)
    const output = JSON.stringify(buildTopology(inventory))
    for (const value of ['private-annotation', 'private-argument', 'private-value', 'containers']) {
      expect(output).not.toContain(value)
    }
  })
  it('handles an empty cluster', () => {
    expect(buildTopology({ nodes: [], pods: [], services: [], slices: [] }).network.nodes).toEqual(
      [],
    )
  })
})
