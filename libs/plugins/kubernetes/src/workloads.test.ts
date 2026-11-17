import { checkNetwork, drawNetwork, resolveNetwork } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { testMetrics } from '../../../@shumoku/core/src/drawing/testing/support.js'
import type { Inventory, Resource } from './types.js'
import { buildWorkloadTopology } from './workloads.js'

function resource(uid: string, kind: string, owner?: Resource, namespace = 'demo'): Resource {
  return {
    kind,
    metadata: {
      uid,
      name: uid,
      namespace,
      ...(owner
        ? {
            ownerReferences: [
              {
                uid: owner.metadata.uid,
                name: owner.metadata.name,
                kind: owner.kind ?? '',
                controller: true,
              },
            ],
          }
        : {}),
    },
  }
}
function fixture(): Inventory {
  const deployment = resource('web', 'Deployment')
  const old = resource('web-old', 'ReplicaSet', deployment)
  const current = resource('web-new', 'ReplicaSet', deployment)
  const pods = [resource('pod-a', 'Pod', old), resource('pod-b', 'Pod', current)]
  return {
    nodes: [],
    workloads: [deployment, old, current],
    pods,
    services: [resource('service', 'Service')],
    slices: [
      {
        metadata: {
          uid: 'slice',
          name: 'slice',
          namespace: 'demo',
          labels: { 'kubernetes.io/service-name': 'service' },
        },
        endpoints: pods.map((pod) => ({ targetRef: { kind: 'Pod', uid: pod.metadata.uid } })),
      },
    ],
  }
}
describe('Kubernetes service map', () => {
  it('merges rollout ReplicaSets under the Deployment and retains backend Pods in details', () => {
    const result = buildWorkloadTopology(fixture())
    expect(checkNetwork(result.network)).toEqual([])
    expect(result.network.nodes.map((node) => node.label).sort()).toEqual([
      'Deployment: demo/web',
      'Service: demo/service',
    ])
    expect(result.network.links).toHaveLength(1)
    expect(result.network.links[0]?.description).toBe('2 backend Pods')
    expect(result.observation?.nodes?.['k8s:web']?.metadata?.['Pods']).toHaveLength(2)
    expect(result.observation?.nodes?.['k8s:service']?.metadata?.['Backends']).toHaveLength(2)
    const { model } = resolveNetwork({ network: { nodes: [], links: [] } }, [
      { sourceId: 'k8s', status: 'ok', capturedAt: 1, source: result },
    ])
    const scene = drawNetwork(model, { metrics: () => testMetrics })
    expect(scene.nodes).toHaveLength(2)
    expect(scene.wires).toHaveLength(1)
  })
  it('does not guess ownership from names or join missing, stale, cross-namespace or non-controller references', () => {
    for (const change of ['missing', 'kind', 'name', 'namespace', 'controller']) {
      const inventory = fixture()
      const pod = inventory.pods[0]
      const ref = pod?.metadata.ownerReferences?.[0]
      const owner = inventory.workloads?.[1]
      if (!ref || !owner || !pod) throw new Error('missing fixture')
      if (change === 'missing') ref.uid = 'missing'
      if (change === 'kind') ref.kind = 'Job'
      if (change === 'name') ref.name = 'other'
      if (change === 'namespace') owner.metadata.namespace = 'other'
      if (change === 'controller') ref.controller = false
      expect(
        buildWorkloadTopology(inventory).network.nodes.some(
          (node) => node.label === 'Pod: demo/pod-a',
        ),
      ).toBe(true)
    }
  })
  it('resolves Job to CronJob, and keeps standalone Pods and scaled-to-zero workloads', () => {
    const cron = resource('cron', 'CronJob')
    const job = resource('job', 'Job', cron)
    const result = buildWorkloadTopology({
      nodes: [],
      services: [],
      slices: [],
      workloads: [cron, job, resource('idle', 'StatefulSet')],
      pods: [resource('run', 'Pod', job), resource('standalone', 'Pod')],
    })
    expect(result.network.nodes.map((node) => node.label).sort()).toEqual([
      'CronJob: demo/cron',
      'Pod: demo/standalone',
      'StatefulSet: demo/idle',
    ])
  })
  it('keeps different namespaces and UIDs separate and does not copy specs or annotations', () => {
    const inventory = fixture()
    const other = resource('other-web', 'Deployment', undefined, 'other')
    other.metadata.name = 'web'
    inventory.workloads?.push(other)
    inventory.pods.push({
      ...resource('another-pod', 'Pod', other, 'other'),
      spec: { nodeName: 'worker-b' },
    })
    const result = buildWorkloadTopology(inventory)
    expect(
      result.network.nodes.filter((node) => node.label?.startsWith('Deployment:')),
    ).toHaveLength(2)
    expect(result.network.groups?.[0]?.groups).toHaveLength(2)
    expect(result.network.description).toContain('not collected')
    expect(JSON.stringify(result)).not.toContain('ownerReferences')
  })
})
