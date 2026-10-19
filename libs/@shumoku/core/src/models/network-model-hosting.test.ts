import { describe, expect, it } from 'vitest'
import { computeNetworkLayout } from '../layout/unified-engine.js'
import { nodePresentation } from './diagram-presentation.js'
import type { NetworkModel } from './network-model.js'
import { applyGraphEdits } from './network-model-edit.js'
import { readNetworkModel, toNetworkGraph } from './network-model-graph.js'

const model = readNetworkModel(`
groups:
  - { id: rack }
  - { id: workloads }
redundancy:
  - { id: pool, label: Production, nodes: [host-a, host-b] }
nodes:
  - { id: host-a, label: Hypervisor A, type: server, group: rack }
  - { id: host-b, label: Hypervisor B, type: server, group: rack }
  - { id: vm, type: virtual-machine, host: host-a, group: workloads }
  - { id: pooled, type: vm, host: pool }
  - { id: service, host: host-a }
  - { id: unplaced, type: vm }
links:
  - { endpoints: [{ node: host-a }, { node: vm }], virtual: true }
`)

describe('hosting is independent of network connectivity', () => {
  it('draws only authored communication links, including explicit host-to-VM links', () => {
    const graph = toNetworkGraph(model)
    expect(graph.links).toHaveLength(1)
    expect(graph.links[0]).toMatchObject({
      from: { node: 'host-a' },
      to: { node: 'vm' },
      type: 'dashed',
    })
    expect(graph.links.some((l) => l.type === 'runs-on')).toBe(false)
    expect(graph.nodes.find((n) => n.id === 'pooled')?.ports).toBeUndefined()
  })

  it('identifies VMs without turning hosted services into VMs or inheriting a host location', () => {
    const projected: NetworkModel = {
      ...model,
      design: {
        nodes: {
          service: { spec: { kind: 'service', service: 'application' } },
          unplaced: { spec: { kind: 'compute', platform: 'esxi' } },
        },
      },
    }
    const graph = toNetworkGraph(projected)
    const vm = graph.nodes.find((n) => n.id === 'vm')
    expect(vm?.spec?.kind).toBe('compute')
    expect(vm?.parent).toBe('workloads')
    expect(vm && nodePresentation(vm).badge).toBe('VM')
    const service = graph.nodes.find((n) => n.id === 'service')
    expect(service?.spec?.kind).toBe('service')
    expect(service && nodePresentation(service).badge).toBe('Hosted')
    const unplaced = graph.nodes.find((n) => n.id === 'unplaced')
    expect(unplaced && nodePresentation(unplaced).badge).toBe('VM')
  })

  it('keeps exact hosts and pools distinct in visible facts', () => {
    const graph = toNetworkGraph(model)
    expect(graph.nodes.find((n) => n.id === 'vm')?.annotations).toContainEqual({
      kind: 'relation',
      label: 'Host',
      value: 'Hypervisor A',
    })
    expect(graph.nodes.find((n) => n.id === 'pooled')?.annotations).toContainEqual({
      kind: 'relation',
      label: 'Host pool',
      value: 'Production (host-a, host-b)',
    })
  })

  it('lays a hosted node out under its host without drawing anything between them', async () => {
    const { resolved } = await computeNetworkLayout(
      toNetworkGraph(
        readNetworkModel(`
nodes:
  - { id: sw, type: l2-switch }
  - { id: esx, type: server }
  - { id: vm, type: vm, host: esx }
  - { id: lan, type: l2-switch }
links:
  - { endpoints: [{ node: sw }, { node: esx }] }
  - { endpoints: [{ node: lan }, { node: vm }], virtual: true }
`),
      ),
    )
    const esx = resolved.nodes.get('esx')?.position
    const vm = resolved.nodes.get('vm')?.position
    expect(esx && vm && vm.y > esx.y).toBe(true)
    expect(resolved.edges.size).toBe(2)
  })

  it('preserves hosting when editing or removing a real portless host-to-VM link', () => {
    const graph = toNetworkGraph(model)
    const changed = applyGraphEdits(model, graph, {
      ...graph,
      links: graph.links.map((l) => ({ ...l, rateBps: 50e6 })),
    })
    expect(changed.config.links[0]?.speed).toBe('50M')
    expect(changed.config.nodes.find((n) => n.id === 'vm')?.host).toBe('host-a')
    const removed = applyGraphEdits(model, graph, { ...graph, links: [] })
    expect(removed.config.links).toEqual([])
    expect(removed.config.nodes.find((n) => n.id === 'vm')?.host).toBe('host-a')
  })

  it('preserves VM authoring types and hosting when moving and renaming nodes', () => {
    const graph = toNetworkGraph(model)
    const changed = applyGraphEdits(model, graph, {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === 'vm' ? { ...n, label: 'Application', position: { x: 50, y: 100 } } : n,
      ),
    })
    expect(changed.config.nodes.find((n) => n.id === 'vm')).toEqual({
      id: 'vm',
      label: 'Application',
      type: 'virtual-machine',
      host: 'host-a',
      group: 'workloads',
    })
    expect(changed.drawing?.nodes?.vm?.position).toEqual({ x: 50, y: 100 })
    expect(model.config.nodes.find((n) => n.id === 'vm')?.label).toBeUndefined()
  })

  it('clears a removed host or dissolved pool without assigning its workloads elsewhere', () => {
    const graph = toNetworkGraph(model)
    const changed = applyGraphEdits(model, graph, {
      ...graph,
      nodes: graph.nodes.filter((n) => n.id !== 'host-a'),
      links: [],
    })
    expect(changed.config.redundancy).toBeUndefined()
    expect(changed.config.nodes.find((n) => n.id === 'vm')?.host).toBeUndefined()
    expect(changed.config.nodes.find((n) => n.id === 'pooled')?.host).toBeUndefined()
  })
})
