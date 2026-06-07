// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { MetricsBindingAttachment, NetworkGraph } from '../models/types.js'
import { resolve, type SnapshotEntry } from './index.js'
import { deriveMappingFromGraph, metricsBindingOf } from './metrics-binding.js'

const nodeBinding = (sourceId: string, hostId: string): MetricsBindingAttachment => ({
  kind: 'metrics-binding',
  sourceId,
  hostId,
  hostName: `host-${hostId}`,
})

const portBinding = (
  sourceId: string,
  ifName: string,
  bandwidth?: number,
): MetricsBindingAttachment => ({
  kind: 'metrics-binding',
  sourceId,
  interfaceIdentity: { ifName },
  ...(bandwidth !== undefined ? { bandwidth } : {}),
})

describe('deriveMappingFromGraph', () => {
  it('derives node host binding from a node attachment', () => {
    const graph: NetworkGraph = {
      version: '1.0',
      nodes: [
        { id: 'n1', label: 'R1', connectors: undefined, attachments: [nodeBinding('zbx', '42')] },
      ],
      links: [],
    } as unknown as NetworkGraph
    const mapping = deriveMappingFromGraph(graph)
    expect(mapping.nodes['n1']).toEqual({ hostId: '42', hostName: 'host-42' })
  })

  it('derives link interface binding from a port attachment, keyed link.id', () => {
    const graph: NetworkGraph = {
      version: '1.0',
      nodes: [
        {
          id: 'n1',
          label: 'R1',
          ports: [
            {
              id: 'p1',
              label: 'Gi0/1',
              connectors: ['rj45'],
              attachments: [portBinding('zbx', 'Gi0/1', 1000)],
            },
          ],
        },
        { id: 'n2', label: 'R2', ports: [{ id: 'p2', label: 'Gi0/1', connectors: ['rj45'] }] },
      ],
      links: [{ id: 'l1', from: { node: 'n1', port: 'p1' }, to: { node: 'n2', port: 'p2' } }],
    } as unknown as NetworkGraph
    const mapping = deriveMappingFromGraph(graph)
    expect(mapping.links['l1']).toEqual({
      monitoredNodeId: 'n1',
      interface: 'Gi0/1',
      bandwidth: 1000,
    })
  })

  it('falls back to positional link key when link.id is absent', () => {
    const graph: NetworkGraph = {
      version: '1.0',
      nodes: [
        {
          id: 'n1',
          label: 'R1',
          ports: [
            {
              id: 'p1',
              label: 'Gi0/1',
              connectors: ['rj45'],
              attachments: [portBinding('zbx', 'Gi0/1')],
            },
          ],
        },
        { id: 'n2', label: 'R2', ports: [{ id: 'p2', label: 'x', connectors: ['rj45'] }] },
      ],
      links: [{ from: { node: 'n1', port: 'p1' }, to: { node: 'n2', port: 'p2' } }],
    } as unknown as NetworkGraph
    const mapping = deriveMappingFromGraph(graph)
    expect(mapping.links['link-0']?.monitoredNodeId).toBe('n1')
  })

  it('returns empty maps when there are no bindings', () => {
    const graph: NetworkGraph = {
      version: '1.0',
      nodes: [{ id: 'n1', label: 'R1' }],
      links: [],
    } as unknown as NetworkGraph
    expect(deriveMappingFromGraph(graph)).toEqual({ nodes: {}, links: {} })
  })
})

describe('metricsBindingOf', () => {
  it('picks the metrics-binding among mixed attachments', () => {
    const b = metricsBindingOf([{ kind: 'policy' }, nodeBinding('zbx', '1')])
    expect(b?.kind).toBe('metrics-binding')
    expect(metricsBindingOf([{ kind: 'policy' }])).toBeUndefined()
    expect(metricsBindingOf(undefined)).toBeUndefined()
  })
})

describe('resolve folds metrics-binding by identity (re-sync follow)', () => {
  it('intrinsic node binding lands on the identity-matched observed node', () => {
    // The keystone: the binding is keyed by identity (mgmtIp), so it follows
    // the device even though the observed snapshot uses a different positional
    // id. Re-sync / reorder can never detach it.
    const intrinsic: NetworkGraph = {
      version: '1.0',
      nodes: [
        {
          id: 'intrinsic-1',
          label: '',
          shape: 'rect',
          identity: { mgmtIp: '10.0.0.1' },
          attachments: [nodeBinding('zbx', '42')],
        },
      ],
      links: [],
    }
    const observed: SnapshotEntry = {
      sourceId: 'netbox',
      capturedAt: 1,
      status: 'ok',
      graph: {
        version: '1.0',
        nodes: [
          { id: 'discovered:7', label: 'R1', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
        ],
        links: [],
      },
    }
    const out = resolve(intrinsic, [observed])
    expect(out.nodes).toHaveLength(1)
    const mapping = deriveMappingFromGraph(out)
    const resolvedId = out.nodes[0]?.id ?? ''
    expect(mapping.nodes[resolvedId]).toEqual({ hostId: '42', hostName: 'host-42' })
  })

  it('intrinsic port binding folds onto the identity-matched port; human can suppress it', () => {
    const makeAuthored = (suppress: boolean): NetworkGraph => ({
      version: '1.0',
      nodes: [
        {
          id: 'intrinsic-1',
          label: '',
          shape: 'rect',
          identity: { mgmtIp: '10.0.0.1' },
          ports: [
            {
              id: 'ap1',
              label: 'Gi0/1',
              connectors: ['rj45'],
              identity: { ifName: 'Gi0/1' },
              attachments: suppress ? undefined : [portBinding('zbx', 'Gi0/1')],
              suppressedAttachments: suppress ? ['metrics-binding:zbx'] : undefined,
            },
          ],
        },
      ],
      links: [],
    })
    const observed: SnapshotEntry = {
      sourceId: 'netbox',
      capturedAt: 1,
      status: 'ok',
      graph: {
        version: '1.0',
        nodes: [
          {
            id: 'discovered:7',
            label: 'R1',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
            ports: [
              {
                id: 'op1',
                label: 'Gi0/1',
                connectors: ['rj45'],
                identity: { ifName: 'Gi0/1' },
                // observed re-supplies the binding — suppression must still win
                attachments: [portBinding('zbx', 'Gi0/1')],
              },
            ],
          },
        ],
        links: [],
      },
    }

    const bound = resolve(makeAuthored(false), [observed])
    const boundPort = bound.nodes[0]?.ports?.[0]
    expect(metricsBindingOf(boundPort?.attachments)).toBeDefined()

    const suppressed = resolve(makeAuthored(true), [observed])
    const suppressedPort = suppressed.nodes[0]?.ports?.[0]
    expect(metricsBindingOf(suppressedPort?.attachments)).toBeUndefined()
  })

  it('link binding survives port folding: endpoint port id is remapped so the binding is discoverable', () => {
    // The observed link references the OBSERVED port id; the intrinsic overlay
    // carries the binding on a port with a different id but the same identity.
    // After fold there is one port (the intrinsic id wins) and the link endpoint
    // must be remapped to it, else deriveMappingFromGraph can't find the binding.
    const intrinsic: NetworkGraph = {
      version: '1.0',
      nodes: [
        {
          id: 'intrinsic-a',
          label: '',
          shape: 'rect',
          identity: { mgmtIp: '10.0.0.1' },
          ports: [
            {
              id: 'intrinsic-port',
              label: 'Gi0/1',
              connectors: ['rj45'],
              identity: { ifName: 'Gi0/1' },
              attachments: [portBinding('zbx', 'Gi0/1', 2000)],
            },
          ],
        },
      ],
      links: [],
    }
    const observed: SnapshotEntry = {
      sourceId: 'netbox',
      capturedAt: 1,
      status: 'ok',
      graph: {
        version: '1.0',
        nodes: [
          {
            id: 'discovered:1',
            label: 'A',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
            ports: [
              {
                id: 'obs-port-a',
                label: 'Gi0/1',
                connectors: ['rj45'],
                identity: { ifName: 'Gi0/1' },
              },
            ],
          },
          {
            id: 'discovered:2',
            label: 'B',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.2' },
            ports: [{ id: 'obs-port-b', label: 'Gi0/2', connectors: ['rj45'] }],
          },
        ],
        links: [
          {
            id: 'L1',
            from: { node: 'discovered:1', port: 'obs-port-a' },
            to: { node: 'discovered:2', port: 'obs-port-b' },
          },
        ],
      },
    }

    const out = resolve(intrinsic, [observed])
    const mapping = deriveMappingFromGraph(out)
    const monitoredNodeId = out.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.1')?.id
    expect(mapping.links['L1']).toEqual({
      monitoredNodeId,
      interface: 'Gi0/1',
      bandwidth: 2000,
    })
  })
})
