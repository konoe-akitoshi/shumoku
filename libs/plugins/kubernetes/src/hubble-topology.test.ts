import { checkNetwork, drawNetwork, resolveNetwork } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { testMetrics } from '../../../@shumoku/core/src/drawing/testing/support.js'
import type { HubbleFlow, HubbleSample } from './hubble.js'
import { addHubbleTopology } from './hubble-topology.js'
import { buildTopology } from './topology.js'
import type { Inventory } from './types.js'
import { buildWorkloadTopology } from './workloads.js'

const inventory: Inventory = {
  nodes: [],
  services: [],
  slices: [],
  pods: ['a', 'b'].map((name) => ({
    metadata: {
      uid: name,
      name,
      namespace: 'demo',
      creationTimestamp: '2026-01-01T00:00:00Z',
      ownerReferences: [{ uid: `deploy-${name}`, name, kind: 'Deployment', controller: true }],
    },
    status: { podIP: name === 'a' ? '10.0.0.1' : '10.0.0.2' },
  })),
  workloads: ['a', 'b'].map((name) => ({
    kind: 'Deployment',
    metadata: { uid: `deploy-${name}`, name, namespace: 'demo' },
  })),
}
const time = Date.parse('2026-01-01T00:01:00Z')
const flow: HubbleFlow = {
  uuid: 'one',
  time: { seconds: String(time / 1000) },
  source: { namespace: 'demo', pod_name: 'a', cluster_name: 'default' },
  destination: { namespace: 'demo', pod_name: 'b', cluster_name: 'default' },
  IP: { source: '10.0.0.1', destination: '10.0.0.2' },
  l4: { TCP: { destination_port: 80 } },
  verdict: 'DROPPED',
  drop_reason_desc: 'POLICY_DENIED',
}
const sample = (flows: HubbleFlow[]): HubbleSample => ({
  since: time - 60000,
  until: time + 1000,
  flows,
  lostEvents: 0,
  unavailableNodes: 0,
  truncated: false,
})
describe('Hubble observation mapping', () => {
  it('adds directional observed edges and detail rows in Pod and workload views', () => {
    for (const build of [buildTopology, buildWorkloadTopology]) {
      const result = addHubbleTopology(build(inventory), inventory, sample([flow, flow]), 'default')
      expect(checkNetwork(result.network)).toEqual([])
      expect(result.network.links).toHaveLength(1)
      const { model } = resolveNetwork({ network: { nodes: [], links: [] } }, [
        { sourceId: 'k8s', status: 'ok', capturedAt: time, source: result },
      ])
      expect(drawNetwork(model, { metrics: () => testMetrics }).wires).toHaveLength(1)
      expect(result.network.links[0]?.description).toBe('observed: 1 DROPPED')
      expect(JSON.stringify(result.observation)).toContain('POLICY_DENIED')
      expect(JSON.stringify(result.observation)).toContain('duplicate UUIDs: 1')
    }
  })
  it('combines reverse flows on one rendered edge while retaining directional detail', () => {
    const reverse = {
      ...flow,
      uuid: 'reply',
      source: flow.destination,
      destination: flow.source,
      IP: { source: '10.0.0.2', destination: '10.0.0.1' },
    }
    const result = addHubbleTopology(
      buildWorkloadTopology(inventory),
      inventory,
      sample([flow, reverse]),
      'default',
    )
    expect(result.network.links).toHaveLength(1)
    expect(result.network.links[0]?.description).toBe('observed: 2 DROPPED')
    const rows = result.observation?.nodes?.['k8s:deploy-a']?.metadata?.['Observed flows']
    expect(rows).toHaveLength(2)
    const { model } = resolveNetwork({ network: { nodes: [], links: [] } }, [
      { sourceId: 'k8s', status: 'ok', capturedAt: time, source: result },
    ])
    expect(drawNetwork(model, { metrics: () => testMetrics }).wires).toHaveLength(1)
  })
  it('renders intra-workload observations without inventing a second node', () => {
    const self = {
      ...flow,
      destination: flow.source,
      IP: { source: '10.0.0.1', destination: '10.0.0.1' },
    }
    const result = addHubbleTopology(
      buildWorkloadTopology(inventory),
      inventory,
      sample([self]),
      'default',
    )
    const { model } = resolveNetwork({ network: { nodes: [], links: [] } }, [
      { sourceId: 'k8s', status: 'ok', capturedAt: time, source: result },
    ])
    expect(drawNetwork(model, { metrics: () => testMetrics }).nodes).toHaveLength(2)
    expect(JSON.stringify(result.observation)).toContain('POLICY_DENIED')
  })
  it('does not attribute old Pod incarnations, reused IPs or remote clusters to current Pods', () => {
    for (const invalid of [
      { ...flow, source: { ...flow.source, cluster_name: 'remote' } },
      { ...flow, IP: { source: '10.0.0.99' } },
      { ...flow, time: { seconds: String((time - 61000) / 1000) } },
      { ...flow, source: { namespace: 'other', pod_name: 'a', cluster_name: 'default' } },
    ]) {
      expect(
        addHubbleTopology(buildTopology(inventory), inventory, sample([invalid]), 'default').network
          .links,
      ).toHaveLength(0)
    }
  })
  it('keeps no-observation and collection failure distinct from healthy traffic', () => {
    const result = addHubbleTopology(
      buildTopology(inventory),
      inventory,
      { ...sample([]), error: 'Hubble unavailable' },
      'default',
    )
    expect(result.observation?.nodes?.['k8s:a']?.metadata?.['Hubble observation']).toBe(
      'Hubble unavailable',
    )
    expect(result.network.links).toHaveLength(0)
  })
})
