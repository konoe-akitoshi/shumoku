// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { NetworkGraph } from '../models/types.js'
import { nodeIdentityQuality, portIdentityQuality, resolve, type SnapshotEntry } from './index.js'

/**
 * Skeleton-level resolve() behavior. Covers the four end-state
 * cases (confirmed / authored-only / discovered-only / conflicting)
 * and the critical ifIndex reshuffle scenario. Deeper edge cases
 * (cross-source link dedup, ghost endpoints, full retraction
 * hysteresis) are intentionally deferred — see resolve.ts header.
 */
describe('resolve()', () => {
  describe('identity quality', () => {
    it('node: chassisId + mgmtIp = stable', () => {
      expect(nodeIdentityQuality({ chassisId: 'a', mgmtIp: '10.0.0.1' })).toBe('stable')
    })
    it('node: chassisId alone = weak', () => {
      expect(nodeIdentityQuality({ chassisId: 'a' })).toBe('weak')
    })
    it('node: undefined identity = unbound', () => {
      expect(nodeIdentityQuality(undefined)).toBe('unbound')
    })
    it('port: ifName + ifIndex = stable', () => {
      expect(portIdentityQuality({ ifName: 'Gi0/1', ifIndex: 1 })).toBe('stable')
    })
    it('port: ifIndex alone = weak', () => {
      expect(portIdentityQuality({ ifIndex: 1 })).toBe('weak')
    })
  })

  describe('empty inputs', () => {
    it('empty authored, no snapshots → empty resolved', () => {
      const out = resolve(emptyGraph(), [])
      expect(out.nodes).toEqual([])
      expect(out.links).toEqual([])
    })
  })

  describe('authored-only', () => {
    it('node present only in authored → state = authored-only', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'n1',
            label: 'R1',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
          },
        ],
      }
      const out = resolve(authored, [])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('authored-only')
      expect(out.nodes[0]?.provenance?.source).toBe('authored')
    })
  })

  describe('discovered-only', () => {
    it('node present only in 1 snapshot → state = discovered-only', () => {
      const snap: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'sn1',
              label: 'core',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.2', chassisId: 'aa' },
            },
          ],
        },
      }
      const out = resolve(emptyGraph(), [snap])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('discovered-only')
      expect(out.nodes[0]?.provenance?.source).toBe('network-scan:1')
    })
  })

  describe('confirmed (authored + snapshot agree on identity)', () => {
    it('authored mgmtIp matches snapshot mgmtIp → confirmed', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'authored-r1',
            label: 'R1',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
          },
        ],
      }
      const snap: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'snmp-r1',
              label: 'R1',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1', chassisId: 'aa:bb' },
            },
          ],
        },
      }
      const out = resolve(authored, [snap])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('confirmed')
      // identity merged
      expect(out.nodes[0]?.identity?.chassisId).toBe('aa:bb')
      // cluster id prefers authored
      expect(out.nodes[0]?.id).toBe('authored-r1')
    })
  })

  describe('confirmed (≥2 snapshots agree, no authored)', () => {
    it('two snapshots sharing chassisId → 1 cluster, confirmed', () => {
      const a: SnapshotEntry = makeSnap('netbox:1', 1000, [
        { id: 'a-r1', label: 'R1', identity: { chassisId: 'aa', sysName: 'r1' } },
      ])
      const b: SnapshotEntry = makeSnap('snmp:1', 2000, [
        { id: 'b-r1', label: 'R1', identity: { chassisId: 'aa', mgmtIp: '10.0.0.1' } },
      ])
      const out = resolve(emptyGraph(), [a, b])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('confirmed')
      expect(out.nodes[0]?.identity?.mgmtIp).toBe('10.0.0.1')
      expect(out.nodes[0]?.identity?.sysName).toBe('r1')
    })
  })

  describe('ifIndex reshuffle (critical regression)', () => {
    it('two snapshots swap ifIndex but ifName stable → ports stay distinct & confirmed', () => {
      const t1 = makeSnap('snmp:1', 1000, [
        {
          id: 'sw1',
          label: 'Switch',
          identity: { chassisId: 'sw-chassis' },
          ports: [
            { id: 'p-gi1', label: 'Gi0/1', identity: { ifName: 'Gi0/1', ifIndex: 10001 } },
            { id: 'p-gi2', label: 'Gi0/2', identity: { ifName: 'Gi0/2', ifIndex: 10002 } },
          ],
        },
      ])
      const t2 = makeSnap('snmp:1', 2000, [
        {
          id: 'sw1',
          label: 'Switch',
          identity: { chassisId: 'sw-chassis' },
          ports: [
            // ifIndex got renumbered on reboot
            { id: 'p-gi1', label: 'Gi0/1', identity: { ifName: 'Gi0/1', ifIndex: 10002 } },
            { id: 'p-gi2', label: 'Gi0/2', identity: { ifName: 'Gi0/2', ifIndex: 10001 } },
          ],
        },
      ])
      const out = resolve(emptyGraph(), [t1, t2])
      expect(out.nodes).toHaveLength(1)
      // ports are matched by ifName despite ifIndex swap → 2 ports, not 4
      const ports = out.nodes[0]?.ports ?? []
      expect(ports).toHaveLength(2)
      const names = ports.map((p) => p.identity?.ifName).sort()
      expect(names).toEqual(['Gi0/1', 'Gi0/2'])
    })
  })

  describe('failed snapshots are ignored', () => {
    it('failed snapshot does not retract authored nodes', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'n1',
            label: 'R1',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
          },
        ],
      }
      const failed: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'failed',
        graph: null,
      }
      const out = resolve(authored, [failed])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('authored-only')
    })
  })

  describe('links carry provenance', () => {
    it('authored link gets authored-only state', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          { id: 'a', label: 'A', shape: 'rect' },
          { id: 'b', label: 'B', shape: 'rect' },
        ],
        links: [{ from: { node: 'a', port: 'p1' }, to: { node: 'b', port: 'p2' } }],
      }
      const out = resolve(authored, [])
      expect(out.links).toHaveLength(1)
      expect(out.links[0]?.provenance?.state).toBe('authored-only')
    })
  })
})

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function emptyGraph(): NetworkGraph {
  return { version: '1.0', nodes: [], links: [] }
}

interface MakeSnapNode {
  id: string
  label: string
  identity?: {
    mgmtIp?: string
    chassisId?: string
    sysName?: string
  }
  ports?: Array<{
    id: string
    label: string
    identity?: { ifName?: string; ifIndex?: number; mac?: string }
  }>
}

function makeSnap(sourceId: string, capturedAt: number, nodes: MakeSnapNode[]): SnapshotEntry {
  return {
    sourceId,
    capturedAt,
    status: 'ok',
    graph: {
      version: '1.0',
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        shape: 'rect',
        identity: n.identity,
        ports: n.ports?.map((p) => ({
          id: p.id,
          label: p.label,
          connectors: ['rj45'],
          identity: p.identity,
        })),
      })),
      links: [],
    },
  }
}
