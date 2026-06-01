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

  describe('synthetic id collision (adopt path)', () => {
    it('authored node carrying a `discovered:N` id does not collide with synthesized ids', () => {
      // Reproduces the adopt path: a discovered node materialized into the
      // authored graph keeps its synthesized `discovered:0` id. A later
      // resolve must not hand that same id to a fresh discovered cluster —
      // duplicate ids crash the keyed grid in the UI.
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'adopted',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.99' },
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
            { id: 'a', label: 'a', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
            { id: 'b', label: 'b', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } },
          ],
        },
      }
      const out = resolve(authored, [snap])
      const ids = out.nodes.map((n) => n.id)
      expect(out.nodes).toHaveLength(3)
      expect(new Set(ids).size).toBe(ids.length) // all unique — no duplicate key
      expect(ids).toContain('discovered:0') // authored node kept its id
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

  describe('authored overlay is thin (community/name on top of observed)', () => {
    // The authored layer is an OVERLAY, not a replacement node. A
    // community-only overlay carries identity + attachments (+ a mirrored
    // label, since Node.label is required) and must NOT blank the device's
    // observed facts — the bug where "adding a community made the device's
    // ports/model/readVia vanish".
    const observed: SnapshotEntry = {
      sourceId: 'network-scan:1',
      capturedAt: 1000,
      status: 'ok',
      graph: {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'sw-core',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.5' },
            metadata: { readVia: 'snmp', syncState: 'synced' },
            ports: [{ id: 'p1', label: 'Gi0/1', connectors: [], identity: { ifName: 'Gi0/1' } }],
          },
        ],
      },
    }

    it('observed facts show through under a community-only overlay', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            // Thin overlay: identity to cluster by, empty label (no rename),
            // and the attachment the operator set. No ports / metadata copied.
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
          },
        ],
      }
      const out = resolve(authored, [observed])
      expect(out.nodes).toHaveLength(1)
      const n = out.nodes[0]
      expect(n?.provenance?.state).toBe('confirmed')
      // observed facts survived
      expect(n?.metadata?.['readVia']).toBe('snmp')
      expect(n?.ports).toHaveLength(1)
      // authored attachment applied
      const acc = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      expect(
        acc && acc.kind === 'access' && acc.protocol === 'snmp' ? acc.community : undefined,
      ).toBe('public')
    })

    it('observed label tracks a source rename when the overlay sets no name', () => {
      // attach-only overlay stores '' (no rename). Source then renames.
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '', // no rename sentinel
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
          },
        ],
      }
      const renamed: SnapshotEntry = {
        ...observed,
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'discovered:0',
              label: 'sw-core-renamed',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.5' },
            },
          ],
        },
      }
      const out = resolve(authored, [renamed])
      // mirrored placeholder must NOT freeze the name — observed rename wins.
      expect(stringOf(out.nodes[0]?.label)).toBe('sw-core-renamed')
    })

    it('an explicit rename overrides the observed label', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'MY-RENAME',
            identity: { mgmtIp: '10.0.0.5' },
          },
        ],
      }
      const out = resolve(authored, [observed])
      expect(stringOf(out.nodes[0]?.label)).toBe('MY-RENAME')
    })
  })

  describe('exclusions (Hide)', () => {
    it('drops a cluster whose identity matches an exclusion', () => {
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'keep', identity: { mgmtIp: '10.0.0.1' } },
        { id: 'b', label: 'junk', identity: { mgmtIp: '10.0.0.2' } },
      ])
      const authored: NetworkGraph = {
        ...emptyGraph(),
        exclusions: [{ mgmtIp: '10.0.0.2' }],
      }
      const out = resolve(authored, [snap])
      const ips = out.nodes.map((n) => n.identity?.mgmtIp)
      expect(ips).toContain('10.0.0.1')
      expect(ips).not.toContain('10.0.0.2')
    })

    it('exclusion is identity-keyed: survives an ephemeral node-id change', () => {
      const authored: NetworkGraph = {
        ...emptyGraph(),
        exclusions: [{ mgmtIp: '10.0.0.2' }],
      }
      // re-scan gives the same device a different id — exclusion still bites.
      const t1 = makeSnap('network-scan:1', 1000, [
        { id: 'discovered:7', label: 'junk', identity: { mgmtIp: '10.0.0.2' } },
      ])
      const t2 = makeSnap('network-scan:1', 2000, [
        { id: 'discovered:99', label: 'junk', identity: { mgmtIp: '10.0.0.2' } },
      ])
      expect(resolve(authored, [t1]).nodes).toHaveLength(0)
      expect(resolve(authored, [t2]).nodes).toHaveLength(0)
    })

    it('matches via any identity key (chassisId hide catches mgmtIp-found node)', () => {
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'junk', identity: { mgmtIp: '10.0.0.5', chassisId: 'aa:bb' } },
      ])
      const authored: NetworkGraph = { ...emptyGraph(), exclusions: [{ chassisId: 'aa:bb' }] }
      expect(resolve(authored, [snap]).nodes).toHaveLength(0)
    })

    it('drops links incident to a hidden node', () => {
      const snap: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'a', label: 'a', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
            { id: 'b', label: 'b', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } },
          ],
          links: [
            {
              id: 'l1',
              from: { node: 'a', port: 'a:p1' },
              to: { node: 'b', port: 'b:p1' },
            },
          ],
        },
      }
      const authored: NetworkGraph = { ...emptyGraph(), exclusions: [{ mgmtIp: '10.0.0.2' }] }
      const out = resolve(authored, [snap])
      expect(out.nodes).toHaveLength(1)
      expect(out.links).toHaveLength(0)
    })

    it('empty exclusion entry matches nothing', () => {
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'a', identity: { mgmtIp: '10.0.0.1' } },
      ])
      const authored: NetworkGraph = { ...emptyGraph(), exclusions: [{}] }
      expect(resolve(authored, [snap]).nodes).toHaveLength(1)
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

function stringOf(label: string | string[] | undefined): string {
  if (label === undefined) return ''
  return Array.isArray(label) ? label.join('\n') : label
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
