// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { NetworkGraph } from '../models/types.js'
import { nodeIdentityQuality, portIdentityQuality, resolve, type SnapshotEntry } from './index.js'

/**
 * resolve() behavior. Covers the four end-state cases (confirmed /
 * intrinsic-only / discovered-only / conflicting), presence/anchor,
 * cross-source link dedup, and the critical ifIndex reshuffle scenario.
 * Deeper edge cases (ghost endpoints, full retraction hysteresis) are
 * intentionally deferred — see resolve.ts header.
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
    it('empty intrinsic, no snapshots → empty resolved', () => {
      const out = resolve(emptyGraph(), [])
      expect(out.nodes).toEqual([])
      expect(out.links).toEqual([])
    })
  })

  describe('intrinsic-only', () => {
    it('node present only in intrinsic → state = intrinsic-only', () => {
      const intrinsic: NetworkGraph = {
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
      const out = resolve(intrinsic, [])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('intrinsic-only')
      expect(out.nodes[0]?.provenance?.source).toBe('intrinsic')
    })
  })

  describe('presence / anchor', () => {
    it('anchor-only cluster (binding-only overlay, no source) is dropped', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'n1',
            label: '',
            presence: 'anchor',
            identity: { mgmtIp: '10.0.0.1' },
            attachments: [{ kind: 'metrics-binding', sourceId: 'zbx', hostId: '7' }],
          },
        ],
      }
      const out = resolve(intrinsic, [])
      expect(out.nodes).toHaveLength(0)
    })

    it('anchor + observed scoop → present, and the anchor attachment folds on', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'n1',
            label: '',
            presence: 'anchor',
            identity: { mgmtIp: '10.0.0.1' },
            attachments: [{ kind: 'metrics-binding', sourceId: 'zbx', hostId: '7' }],
          },
        ],
      }
      const snap: SnapshotEntry = {
        sourceId: 'zbx',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 's1', label: 'core', identity: { mgmtIp: '10.0.0.1' } }],
        },
      }
      const out = resolve(intrinsic, [snap])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.label).toBe('core')
      expect(out.nodes[0]?.attachments).toEqual([
        expect.objectContaining({ kind: 'metrics-binding', sourceId: 'zbx', hostId: '7' }),
      ])
    })

    it('source retraction drops the node even though an anchor binding remains', () => {
      // Same overlay anchor as above, but the source no longer observes the
      // device (empty snapshot) → the cluster is anchor-only → gone (no ghost).
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'n1',
            label: '',
            presence: 'anchor',
            identity: { mgmtIp: '10.0.0.1' },
            attachments: [{ kind: 'metrics-binding', sourceId: 'zbx', hostId: '7' }],
          },
        ],
      }
      const empty: SnapshotEntry = {
        sourceId: 'zbx',
        capturedAt: 2000,
        status: 'ok',
        graph: emptyGraph(),
      }
      const out = resolve(intrinsic, [empty])
      expect(out.nodes).toHaveLength(0)
    })

    it('a plain intrinsic node (scoop, no presence field) still persists unobserved', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [{ id: 'n1', label: 'R1', identity: { mgmtIp: '10.0.0.9' } }],
      }
      const out = resolve(intrinsic, [])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('intrinsic-only')
    })
  })

  describe('link dedup', () => {
    const port = (id: string, ifName: string) => ({
      id,
      label: ifName,
      connectors: [],
      identity: { ifName },
    })
    const twoNodeSnap = (
      sourceId: string,
      capturedAt: number,
      prefix: string,
      link: Partial<NetworkGraph['links'][number]>,
      priority?: number,
    ): SnapshotEntry => ({
      sourceId,
      capturedAt,
      status: 'ok',
      ...(priority !== undefined ? { priority } : {}),
      graph: {
        ...emptyGraph(),
        nodes: [
          {
            id: `${prefix}1`,
            label: 'R1',
            identity: { mgmtIp: '10.0.0.1' },
            ports: [port(`${prefix}1p`, 'e0')],
          },
          {
            id: `${prefix}2`,
            label: 'R2',
            identity: { mgmtIp: '10.0.0.2' },
            ports: [port(`${prefix}2p`, 'e1')],
          },
        ],
        links: [
          {
            from: { node: `${prefix}1`, port: `${prefix}1p` },
            to: { node: `${prefix}2`, port: `${prefix}2p` },
            ...link,
          } as NetworkGraph['links'][number],
        ],
      },
    })

    it('same link from two sources → one edge, fields merged', () => {
      const a = twoNodeSnap('a', 1000, 'a', { metadata: { speed: '1g' } })
      const b = twoNodeSnap('b', 2000, 'b', { vlan: [10] })
      const out = resolve(emptyGraph(), [a, b])
      expect(out.links).toHaveLength(1)
      expect(out.links[0]?.metadata?.['speed']).toBe('1g')
      expect(out.links[0]?.vlan).toEqual([10])
      expect(out.links[0]?.provenance?.state).toBe('confirmed') // 2 observers agree
    })

    it('higher-priority source wins a conflicting link field', () => {
      const lo = twoNodeSnap('lo', 1000, 'a', { metadata: { speed: '1g' } }, 0)
      const hi = twoNodeSnap('hi', 1000, 'b', { metadata: { speed: '100g' } }, 10)
      const out = resolve(emptyGraph(), [lo, hi])
      expect(out.links).toHaveLength(1)
      expect(out.links[0]?.metadata?.['speed']).toBe('100g')
    })

    it('parallel links via different ports stay separate', () => {
      const snap: SnapshotEntry = {
        sourceId: 'p',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'x',
              label: 'X',
              identity: { mgmtIp: '10.0.0.1' },
              ports: [port('xp0', 'e0'), port('xp1', 'e1')],
            },
            {
              id: 'y',
              label: 'Y',
              identity: { mgmtIp: '10.0.0.2' },
              ports: [port('yq0', 'f0'), port('yq1', 'f1')],
            },
          ],
          links: [
            { from: { node: 'x', port: 'xp0' }, to: { node: 'y', port: 'yq0' } },
            { from: { node: 'x', port: 'xp1' }, to: { node: 'y', port: 'yq1' } },
          ] as NetworkGraph['links'],
        },
      }
      const out = resolve(emptyGraph(), [snap])
      expect(out.links).toHaveLength(2)
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
    it('intrinsic node carrying a `discovered:N` id does not collide with synthesized ids', () => {
      // Reproduces the adopt path: a discovered node materialized into the
      // intrinsic graph keeps its synthesized `discovered:0` id. A later
      // resolve must not hand that same id to a fresh discovered cluster —
      // duplicate ids crash the keyed grid in the UI.
      const intrinsic: NetworkGraph = {
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
      const out = resolve(intrinsic, [snap])
      const ids = out.nodes.map((n) => n.id)
      expect(out.nodes).toHaveLength(3)
      expect(new Set(ids).size).toBe(ids.length) // all unique — no duplicate key
      expect(ids).toContain('discovered:0') // intrinsic node kept its id
    })
  })

  describe('confirmed (intrinsic + snapshot agree on identity)', () => {
    it('intrinsic mgmtIp matches snapshot mgmtIp → confirmed', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'intrinsic-r1',
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
      const out = resolve(intrinsic, [snap])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('confirmed')
      // identity merged
      expect(out.nodes[0]?.identity?.chassisId).toBe('aa:bb')
      // cluster id prefers intrinsic
      expect(out.nodes[0]?.id).toBe('intrinsic-r1')
    })
  })

  describe('intrinsic overlay is thin (community/name on top of observed)', () => {
    // The intrinsic layer is an OVERLAY, not a replacement node. A
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
      const intrinsic: NetworkGraph = {
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
      const out = resolve(intrinsic, [observed])
      expect(out.nodes).toHaveLength(1)
      const n = out.nodes[0]
      expect(n?.provenance?.state).toBe('confirmed')
      // observed facts survived
      expect(n?.metadata?.['readVia']).toBe('snmp')
      expect(n?.ports).toHaveLength(1)
      // intrinsic attachment applied
      const acc = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      expect(
        acc && acc.kind === 'access' && acc.protocol === 'snmp' ? acc.community : undefined,
      ).toBe('public')
    })

    it('a policy-only overlay does NOT wipe an observed access attachment', () => {
      // network-scan stamps the community it read with as an observed access
      // attachment. An intrinsic overlay that only sets a policy must merge in,
      // not replace — otherwise the scan-discovered community vanishes and the
      // autoscan scheduler can't resolve it.
      const observedWithAccess: SnapshotEntry = {
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
              metadata: { readVia: 'snmp' },
              attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
            },
          ],
        },
      }
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'policy', mode: 'disabled' }],
          },
        ],
      }
      const n = resolve(intrinsic, [observedWithAccess]).nodes[0]
      const acc = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      expect(
        acc && acc.kind === 'access' && acc.protocol === 'snmp' ? acc.community : undefined,
      ).toBe('public') // observed community survived
      expect((n?.attachments ?? []).some((a) => a.kind === 'policy')).toBe(true) // intrinsic applied
    })

    it('an intrinsic access overrides an observed access of the same protocol', () => {
      const observedWithAccess: SnapshotEntry = {
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
              attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
            },
          ],
        },
      }
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'private-override' }],
          },
        ],
      }
      const n = resolve(intrinsic, [observedWithAccess]).nodes[0]
      const accs = (n?.attachments ?? []).filter(
        (a) => a.kind === 'access' && a.protocol === 'snmp',
      )
      expect(accs).toHaveLength(1) // not duplicated
      const a = accs[0]
      expect(a && a.kind === 'access' && a.protocol === 'snmp' ? a.community : undefined).toBe(
        'private-override',
      )
    })

    it('observed label tracks a source rename when the overlay sets no name', () => {
      // attach-only overlay stores '' (no rename). Source then renames.
      const intrinsic: NetworkGraph = {
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
      const out = resolve(intrinsic, [renamed])
      // mirrored placeholder must NOT freeze the name — observed rename wins.
      expect(stringOf(out.nodes[0]?.label)).toBe('sw-core-renamed')
    })

    it('an explicit rename overrides the observed label', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'MY-RENAME',
            identity: { mgmtIp: '10.0.0.5' },
          },
        ],
      }
      const out = resolve(intrinsic, [observed])
      expect(stringOf(out.nodes[0]?.label)).toBe('MY-RENAME')
    })
  })

  describe('exclusions (Hide)', () => {
    it('drops a cluster whose identity matches an exclusion', () => {
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'keep', identity: { mgmtIp: '10.0.0.1' } },
        { id: 'b', label: 'junk', identity: { mgmtIp: '10.0.0.2' } },
      ])
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        exclusions: [{ mgmtIp: '10.0.0.2' }],
      }
      const out = resolve(intrinsic, [snap])
      const ips = out.nodes.map((n) => n.identity?.mgmtIp)
      expect(ips).toContain('10.0.0.1')
      expect(ips).not.toContain('10.0.0.2')
    })

    it('exclusion is identity-keyed: survives an ephemeral node-id change', () => {
      const intrinsic: NetworkGraph = {
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
      expect(resolve(intrinsic, [t1]).nodes).toHaveLength(0)
      expect(resolve(intrinsic, [t2]).nodes).toHaveLength(0)
    })

    it('matches via any identity key (chassisId hide catches mgmtIp-found node)', () => {
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'junk', identity: { mgmtIp: '10.0.0.5', chassisId: 'aa:bb' } },
      ])
      const intrinsic: NetworkGraph = { ...emptyGraph(), exclusions: [{ chassisId: 'aa:bb' }] }
      expect(resolve(intrinsic, [snap]).nodes).toHaveLength(0)
    })

    it('a multi-key exclusion still matches when one key changed (ANY, not ALL)', () => {
      // Hide is stored with all available keys; a later sysName rename must not
      // silently un-hide the node — mgmtIp still matches.
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'junk', identity: { mgmtIp: '10.0.0.5', sysName: 'new-name' } },
      ])
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        exclusions: [{ mgmtIp: '10.0.0.5', sysName: 'old-name' }],
      }
      expect(resolve(intrinsic, [snap]).nodes).toHaveLength(0)
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
      const intrinsic: NetworkGraph = { ...emptyGraph(), exclusions: [{ mgmtIp: '10.0.0.2' }] }
      const out = resolve(intrinsic, [snap])
      expect(out.nodes).toHaveLength(1)
      expect(out.links).toHaveLength(0)
    })

    it('empty exclusion entry matches nothing', () => {
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'a', identity: { mgmtIp: '10.0.0.1' } },
      ])
      const intrinsic: NetworkGraph = { ...emptyGraph(), exclusions: [{}] }
      expect(resolve(intrinsic, [snap]).nodes).toHaveLength(1)
    })
  })

  describe('confirmed (≥2 snapshots agree, no intrinsic)', () => {
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
    it('failed snapshot does not retract intrinsic nodes', () => {
      const intrinsic: NetworkGraph = {
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
      const out = resolve(intrinsic, [failed])
      expect(out.nodes).toHaveLength(1)
      expect(out.nodes[0]?.provenance?.state).toBe('intrinsic-only')
    })
  })

  describe('links carry provenance', () => {
    it('intrinsic link gets intrinsic-only state', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          { id: 'a', label: 'A', shape: 'rect' },
          { id: 'b', label: 'B', shape: 'rect' },
        ],
        links: [{ from: { node: 'a', port: 'p1' }, to: { node: 'b', port: 'p2' } }],
      }
      const out = resolve(intrinsic, [])
      expect(out.links).toHaveLength(1)
      expect(out.links[0]?.provenance?.state).toBe('intrinsic-only')
    })
  })

  // -------------------------------------------------------------------------
  // Priority field merge — the heart of the redesign. All sources (incl. the
  // human/intrinsic graph) are equal, priority-ordered contributions; per
  // field the highest-priority contribution that holds a value wins.
  // -------------------------------------------------------------------------
  describe('priority field merge (C1)', () => {
    it('two observed sources merge field-by-field; higher priority wins, missing fields fall through', () => {
      // Same device (mgmtIp) seen by two sources at different priorities.
      const hi: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 10,
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'nb-1',
              label: 'hi-name',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1' },
              spec: { kind: 'hardware', model: 'modelHi' },
              // hi has NO ports — that field must fall through to lo.
            },
          ],
        },
      }
      const lo: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        priority: 5,
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'scan-1',
              label: 'lo-name',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1' },
              spec: { kind: 'hardware', model: 'modelLo' },
              ports: [{ id: 'p1', label: 'Gi0/1', connectors: [], identity: { ifName: 'Gi0/1' } }],
            },
          ],
        },
      }
      const out = resolve(emptyGraph(), [lo, hi]) // order independent of priority
      expect(out.nodes).toHaveLength(1)
      const n = out.nodes[0]
      // higher priority (netbox:1) wins the fields it holds
      expect(stringOf(n?.label)).toBe('hi-name')
      expect(n?.spec?.kind === 'hardware' ? n.spec.model : undefined).toBe('modelHi')
      expect(n?.fieldSources?.['label']).toBe('netbox:1')
      // ports fall through to the only source that holds them
      expect(n?.ports).toHaveLength(1)
      expect(n?.ports?.[0]?.identity?.ifName).toBe('Gi0/1')
    })

    it('human (intrinsic) outranks every observed source per field', () => {
      const lo: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        priority: 5,
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'scan-1',
              label: 'observed-name',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1' },
              spec: { kind: 'hardware', model: 'observed-model' },
              ports: [{ id: 'p1', label: 'Gi0/1', connectors: [], identity: { ifName: 'Gi0/1' } }],
            },
          ],
        },
      }
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'HUMAN-RENAME',
            identity: { mgmtIp: '10.0.0.1' },
          },
        ],
      }
      const n = resolve(intrinsic, [lo]).nodes[0]
      // human wins label (it holds one) — "human wins" = "+Infinity priority"
      expect(stringOf(n?.label)).toBe('HUMAN-RENAME')
      expect(n?.fieldSources?.['label']).toBe('intrinsic')
      // human held no spec/ports → observed still flows through
      expect(n?.spec?.kind === 'hardware' ? n.spec.model : undefined).toBe('observed-model')
      expect(n?.ports).toHaveLength(1)
      expect(n?.provenance?.state).toBe('confirmed')
    })
  })

  describe('empty = no value (C2, decision 1)', () => {
    it('a high-priority empty string field yields to a lower-priority real value', () => {
      const hi: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 10,
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'nb-1', label: '', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }, // empty name
          ],
        },
      }
      const lo: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        priority: 5,
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'scan-1', label: 'real-name', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
          ],
        },
      }
      const n = resolve(emptyGraph(), [hi, lo]).nodes[0]
      // hi's empty label makes no claim → lo's real value wins despite lower priority
      expect(stringOf(n?.label)).toBe('real-name')
      expect(n?.fieldSources?.['label']).toBe('network-scan:1')
    })

    it('a high-priority empty-array label yields too', () => {
      const hi: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 10,
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'nb-1', label: [], shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
        },
      }
      const lo: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        priority: 5,
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'scan-1', label: 'visible', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
          ],
        },
      }
      const n = resolve(emptyGraph(), [hi, lo]).nodes[0]
      expect(stringOf(n?.label)).toBe('visible')
    })
  })

  describe('human partial node, no sentinel dependence (C3, decision 3)', () => {
    it('a human overlay that only sets an attachment makes no claim on the name (observed shows through)', () => {
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
              metadata: { readVia: 'snmp' },
              ports: [{ id: 'p1', label: 'Gi0/1', connectors: [], identity: { ifName: 'Gi0/1' } }],
              attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
            },
          ],
        },
      }
      // Partial node: identity + a policy attachment. label '' is NOT a
      // sentinel here — it just fails hasValue, so no name claim is made.
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'policy', mode: 'disabled' }],
          },
        ],
      }
      const n = resolve(intrinsic, [observed]).nodes[0]
      // observed name shows through; the human made no label claim
      expect(stringOf(n?.label)).toBe('sw-core')
      expect(n?.fieldSources?.['label']).toBe('network-scan:1')
      // observed facts survive
      expect(n?.metadata?.['readVia']).toBe('snmp')
      expect(n?.ports).toHaveLength(1)
      // both attachments present
      expect((n?.attachments ?? []).some((a) => a.kind === 'policy')).toBe(true)
      expect((n?.attachments ?? []).some((a) => a.kind === 'access' && a.protocol === 'snmp')).toBe(
        true,
      )
    })
  })

  describe('attachment provenance (C6, decision 5)', () => {
    it('observed and human attachments carry distinct provenance sources', () => {
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
              attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
            },
          ],
        },
      }
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'ssh', username: 'admin' }],
          },
        ],
      }
      const n = resolve(intrinsic, [observed]).nodes[0]
      const snmp = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      const ssh = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'ssh')
      // observed access is attributed to the observing source (UI: read-only)
      expect(snmp?.provenance?.source).toBe('network-scan:1')
      // human access is attributed to 'intrinsic' (UI: editable / ✕)
      expect(ssh?.provenance?.source).toBe('intrinsic')
    })

    it('a human access that overrides an observed one is attributed to the human', () => {
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
              attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
            },
          ],
        },
      }
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'override' }],
          },
        ],
      }
      const n = resolve(intrinsic, [observed]).nodes[0]
      const accs = (n?.attachments ?? []).filter(
        (a) => a.kind === 'access' && a.protocol === 'snmp',
      )
      expect(accs).toHaveLength(1)
      const a = accs[0]
      expect(a && a.kind === 'access' && a.protocol === 'snmp' ? a.community : undefined).toBe(
        'override',
      )
      expect(a?.provenance?.source).toBe('intrinsic')
    })
  })

  // -------------------------------------------------------------------------
  // Reset removes the human contribution; the node returns to the observed
  // bare state via the priority merge — not by "peeling a layer" (C4).
  // -------------------------------------------------------------------------
  describe('Reset = remove the human contribution (C4)', () => {
    const observed: SnapshotEntry = {
      sourceId: 'network-scan:1',
      capturedAt: 1000,
      status: 'ok',
      graph: {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'scan-name',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
          },
        ],
      },
    }
    const communityOf = (n: { attachments?: unknown[] } | undefined): string | undefined => {
      const a = (n?.attachments ?? []).find(
        (x): x is { kind: 'access'; protocol: 'snmp'; community?: string } =>
          !!x &&
          typeof x === 'object' &&
          (x as { kind?: string }).kind === 'access' &&
          (x as { protocol?: string }).protocol === 'snmp',
      )
      return a?.community
    }

    it('with the human overlay present, human name + community win', () => {
      const withHuman: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'MY-NAME',
            identity: { mgmtIp: '10.0.0.5' },
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'private' }],
          },
        ],
      }
      const n = resolve(withHuman, [observed]).nodes[0]
      expect(stringOf(n?.label)).toBe('MY-NAME')
      expect(communityOf(n)).toBe('private')
      expect(n?.fieldSources?.['label']).toBe('intrinsic')
    })

    it('dropping the human contribution returns the node to the observed name + community', () => {
      // Reset = the node's entry is gone from the intrinsic graph.
      const n = resolve(emptyGraph(), [observed]).nodes[0]
      expect(stringOf(n?.label)).toBe('scan-name') // observed name surfaces
      expect(communityOf(n)).toBe('public') // observed community surfaces
      expect(n?.fieldSources?.['label']).toBe('network-scan:1')
      // the surviving community is observed-derived → read-only in the UI
      const acc = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      expect(acc?.provenance?.source).toBe('network-scan:1')
    })
  })

  // -------------------------------------------------------------------------
  // Retraction is orthogonal to priority (decision 4 / C7). Presence is the
  // union of contributions; priority only decides per-field winners. Human
  // contributions and policy=disabled overlays persist; failed snapshots
  // never retract; priority changes none of this.
  // -------------------------------------------------------------------------
  describe('retraction orthogonal to priority (C7)', () => {
    it('priority does not affect presence: a node seen only by a low-priority source survives a high-priority source that omits it', () => {
      const hi: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 100,
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'a', label: 'A', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
        },
      }
      const lo: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        priority: 1,
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'a2', label: 'A', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } },
            // B is held ONLY by the low-priority source.
            { id: 'b', label: 'B', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } },
          ],
        },
      }
      const out = resolve(emptyGraph(), [hi, lo])
      const ips = out.nodes.map((n) => n.identity?.mgmtIp).sort()
      expect(ips).toEqual(['10.0.0.1', '10.0.0.2']) // B not dropped despite low priority
    })

    it('a human overlay (policy=disabled) persists when no observed snapshot carries it', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.9' },
            attachments: [{ kind: 'policy', mode: 'disabled' }],
          },
        ],
      }
      // A high-priority source that observes a DIFFERENT device — it must not
      // retract the human's node just because it doesn't see it.
      const other: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 100,
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'x', label: 'X', shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
        },
      }
      const out = resolve(intrinsic, [other])
      const disabled = out.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.9')
      expect(disabled).toBeDefined()
      expect(disabled?.provenance?.state).toBe('intrinsic-only')
      expect((disabled?.attachments ?? []).some((a) => a.kind === 'policy')).toBe(true)
    })

    it('an observed-only node vanishing from the latest snapshot is retracted, but the same device persists when the human kept it', () => {
      // latest snapshot no longer carries the device.
      const latest: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 5,
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'y', label: 'Y', shape: 'rect', identity: { mgmtIp: '10.0.0.2' } }],
        },
      }
      // observed-only → device .1 is gone (retracted) when nobody carries it.
      expect(resolve(emptyGraph(), [latest]).nodes.map((n) => n.identity?.mgmtIp)).toEqual([
        '10.0.0.2',
      ])
      // human kept .1 → it persists even though the source dropped it.
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [{ id: 'kept', label: 'kept', identity: { mgmtIp: '10.0.0.1' } }],
      }
      const ips = resolve(intrinsic, [latest])
        .nodes.map((n) => n.identity?.mgmtIp)
        .sort()
      expect(ips).toEqual(['10.0.0.1', '10.0.0.2'])
    })
  })

  describe('empty values do not count as a conflict (hasValue consistency)', () => {
    it('an empty label from one observer is a fall-through, not a conflict', () => {
      const empty = makeSnap('a:1', 1000, [{ id: 'a', label: '', identity: { chassisId: 'cc' } }])
      const real = makeSnap('b:1', 2000, [
        { id: 'b', label: 'real-name', identity: { chassisId: 'cc' } },
      ])
      const n = resolve(emptyGraph(), [empty, real]).nodes[0]
      expect(stringOf(n?.label)).toBe('real-name')
      // two observers, but only ONE non-empty label → not conflicting
      expect(n?.provenance?.state).not.toBe('conflicting')
    })
  })

  describe('port field merge falls through empty values (§6)', () => {
    it('a high-priority port with empty connectors yields to a lower-priority one that has them', () => {
      const hi: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        priority: 10,
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'nb',
              label: 'sw',
              shape: 'rect',
              identity: { chassisId: 'cc' },
              // same port by ifName, but no connectors observed here
              ports: [
                { id: 'p-hi', label: 'Gi0/1', connectors: [], identity: { ifName: 'Gi0/1' } },
              ],
            },
          ],
        },
      }
      const lo: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1000,
        status: 'ok',
        priority: 5,
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'scan',
              label: 'sw',
              shape: 'rect',
              identity: { chassisId: 'cc' },
              ports: [
                { id: 'p-lo', label: 'Gi0/1', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } },
              ],
            },
          ],
        },
      }
      const n = resolve(emptyGraph(), [hi, lo]).nodes[0]
      expect(n?.ports).toHaveLength(1)
      // connectors fell through from the lower-priority source that has them
      expect(n?.ports?.[0]?.connectors).toEqual(['rj45'])
    })
  })

  // -------------------------------------------------------------------------
  // Human suppression — the negative counterpart to an override. The human
  // can remove an attachment a source supplied; it stays gone across re-scans
  // (the assertion persists) and returns only when the human contribution is
  // dropped (Reset). No observed/intrinsic layers — just add / override /
  // remove on one node.
  // -------------------------------------------------------------------------
  describe('human suppression of an observed attachment', () => {
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
            attachments: [
              { kind: 'access', protocol: 'snmp', community: 'public' },
              { kind: 'access', protocol: 'ssh', username: 'observed-admin' },
            ],
          },
        ],
      },
    }

    it('a suppressed key is dropped even though the source supplies it', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.5' },
            suppressedAttachments: ['access:snmp'],
          },
        ],
      }
      const n = resolve(intrinsic, [observed]).nodes[0]
      // snmp removed by the human; ssh (not suppressed) still shows
      expect((n?.attachments ?? []).some((a) => a.kind === 'access' && a.protocol === 'snmp')).toBe(
        false,
      )
      expect((n?.attachments ?? []).some((a) => a.kind === 'access' && a.protocol === 'ssh')).toBe(
        true,
      )
      // node itself survives, and the suppression rides along for UI round-trip
      expect(n?.identity?.mgmtIp).toBe('10.0.0.5')
      expect(n?.suppressedAttachments).toEqual(['access:snmp'])
    })

    it('dropping the human contribution (Reset) brings the suppressed access back', () => {
      const n = resolve(emptyGraph(), [observed]).nodes[0]
      expect((n?.attachments ?? []).some((a) => a.kind === 'access' && a.protocol === 'snmp')).toBe(
        true,
      )
      expect(n?.suppressedAttachments).toBeUndefined()
    })

    it('only the human suppresses — a source cannot remove another source attachment', () => {
      // a second source carrying suppressedAttachments must NOT drop anything
      // (suppression is a human-only, top-priority assertion).
      const sourceWithSuppress: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 2000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'nb',
              label: 'sw',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.5' },
              suppressedAttachments: ['access:snmp'],
            },
          ],
        },
      }
      const n = resolve(emptyGraph(), [observed, sourceWithSuppress]).nodes[0]
      // snmp survives — a non-human source's suppressedAttachments is ignored
      expect((n?.attachments ?? []).some((a) => a.kind === 'access' && a.protocol === 'snmp')).toBe(
        true,
      )
    })
  })

  // -------------------------------------------------------------------------
  // The whole model in one place: a node is ONE thing; data sources, observed
  // snapshots and the human are equal, priority-ordered contributions merged
  // field-by-field — a Git-style non-conflicting auto-merge. The human is just
  // the top-priority source (can add / override / remove); untouched fields
  // flow through from whoever has them; non-matching identities stay separate.
  // -------------------------------------------------------------------------
  describe('Git-like merge: one node from equal contributions, field by field', () => {
    // Same device seen by NetBox (high priority, has the model) and a scan
    // (lower priority, has ports + community). The human touches only the name.
    const netbox: SnapshotEntry = {
      sourceId: 'netbox:1',
      capturedAt: 2000,
      status: 'ok',
      priority: 10,
      graph: {
        ...emptyGraph(),
        nodes: [
          {
            id: 'nb',
            label: 'NB-NAME',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
            spec: { kind: 'hardware', model: 'C9300' },
          },
        ],
      },
    }
    const scan: SnapshotEntry = {
      sourceId: 'network-scan:1',
      capturedAt: 1000,
      status: 'ok',
      priority: 5,
      graph: {
        ...emptyGraph(),
        nodes: [
          {
            id: 'scan',
            label: 'scan-name',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1', chassisId: 'cc' },
            ports: [
              { id: 'p', label: 'Gi0/1', connectors: ['rj45'], identity: { ifName: 'Gi0/1' } },
            ],
            attachments: [{ kind: 'access', protocol: 'snmp', community: 'public' }],
          },
        ],
      },
    }
    const human: NetworkGraph = {
      ...emptyGraph(),
      nodes: [{ id: 'discovered:0', label: 'MY-NAME', identity: { mgmtIp: '10.0.0.1' } }],
    }

    it('one node: human name + NetBox model + scan ports + scan community, merged like Git', () => {
      const out = resolve(human, [scan, netbox])
      expect(out.nodes).toHaveLength(1) // one thing, not three
      const n = out.nodes[0]
      expect(stringOf(n?.label)).toBe('MY-NAME') // human won the one field it touched
      expect(n?.fieldSources?.['label']).toBe('intrinsic')
      // untouched fields flow through from whoever holds them (priority order)
      expect(n?.spec?.kind === 'hardware' ? n.spec.model : undefined).toBe('C9300') // NetBox (10)
      expect(n?.ports?.[0]?.identity?.ifName).toBe('Gi0/1') // scan
      const acc = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      expect(
        acc && acc.kind === 'access' && acc.protocol === 'snmp' ? acc.community : undefined,
      ).toBe('public') // scan
      expect(n?.identity?.chassisId).toBe('cc') // identity is the union
    })

    it('drop the human (Reset) → name reverts to the top-priority source; the rest is unchanged', () => {
      const n = resolve(emptyGraph(), [scan, netbox]).nodes[0]
      expect(stringOf(n?.label)).toBe('NB-NAME') // NetBox (10) now wins the name
      expect(n?.spec?.kind === 'hardware' ? n.spec.model : undefined).toBe('C9300')
      expect(n?.ports?.[0]?.identity?.ifName).toBe('Gi0/1')
    })

    it('a non-matching identity stays a separate island (never force-merged)', () => {
      const other = makeSnap('network-scan:1', 1000, [
        { id: 'x', label: 'other', identity: { mgmtIp: '10.99.99.99' } },
      ])
      expect(resolve(emptyGraph(), [scan, other]).nodes).toHaveLength(2)
    })

    it('the human can also remove (delete) a field a source supplied; Reset brings it back', () => {
      const del: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: '',
            identity: { mgmtIp: '10.0.0.1' },
            suppressedAttachments: ['access:snmp'],
          },
        ],
      }
      // human deleted the scan's community → gone
      const deleted = resolve(del, [scan, netbox]).nodes[0]
      expect((deleted?.attachments ?? []).some((a) => a.kind === 'access')).toBe(false)
      // Reset (no human) → the source's community is back
      const reset = resolve(emptyGraph(), [scan, netbox]).nodes[0]
      expect(
        (reset?.attachments ?? []).some((a) => a.kind === 'access' && a.protocol === 'snmp'),
      ).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Status reflects reality, not decoration: `observedAt` ("Last seen") is the
  // latest real observation time and must survive a human edit (the human
  // contribution's capturedAt is +Infinity and must not poison it).
  // -------------------------------------------------------------------------
  describe('observedAt reflects the last observation, not the human edit', () => {
    it('a human-touched node still reports the observed time (not blank)', () => {
      const observed: SnapshotEntry = {
        sourceId: 'network-scan:1',
        capturedAt: 1_700_000_000_000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'discovered:0', label: 'sw', shape: 'rect', identity: { mgmtIp: '10.0.0.7' } },
          ],
        },
      }
      const human: NetworkGraph = {
        ...emptyGraph(),
        nodes: [{ id: 'discovered:0', label: 'MY-NAME', identity: { mgmtIp: '10.0.0.7' } }],
      }
      const n = resolve(human, [observed]).nodes[0]
      expect(n?.provenance?.observedAt).toBe(1_700_000_000_000)
    })

    it('an intrinsic-only node (never observed) has no observedAt', () => {
      const human: NetworkGraph = {
        ...emptyGraph(),
        nodes: [{ id: 'n', label: 'X', identity: { mgmtIp: '10.0.0.8' } }],
      }
      const n = resolve(human, []).nodes[0]
      expect(n?.provenance?.observedAt).toBeUndefined()
    })
  })

  describe('source subgraphs (fold + namespacing)', () => {
    it('folds a source subgraph and namespaces its id + node.parent so membership resolves', () => {
      const snap: SnapshotEntry = {
        sourceId: 'src-a:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'n1',
              label: 'web',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1' },
              parent: 'sg-2',
            },
          ],
          subgraphs: [{ id: 'sg-2', label: 'Rack 2' }],
        },
      }
      const out = resolve(emptyGraph(), [snap])
      expect(out.subgraphs).toHaveLength(1)
      expect(out.subgraphs?.[0]?.id).toBe('src-a:1:sg-2')
      expect(out.subgraphs?.[0]?.label).toBe('Rack 2')
      expect(out.subgraphs?.[0]?.provenance?.source).toBe('src-a:1')
      // the resolved node's parent points at the namespaced id → not dangling
      expect(out.nodes[0]?.parent).toBe('src-a:1:sg-2')
    })

    it('restamps subgraph provenance — a stale inbound provenance never survives', () => {
      // A subgraph whose stored input still carries an old provenance (e.g. a
      // pre-rename `source: 'authored'`) must NOT leak that into the resolved
      // output: resolve is the sole authority and always restamps.
      const intrinsic = {
        ...emptyGraph(),
        // A member node keeps the subgraph (empty subgraphs are pruned).
        nodes: [{ id: 'n', label: 'N', parent: 'sg-stale' }],
        subgraphs: [
          {
            id: 'sg-stale',
            label: 'Rack',
            // biome-ignore lint/suspicious/noExplicitAny: deliberately injecting a stale value
            provenance: { source: 'authored', state: 'authored-only' } as any,
          },
        ],
      }
      const out = resolve(intrinsic, [])
      expect(out.subgraphs?.[0]?.provenance?.source).toBe('intrinsic')
      expect(out.subgraphs?.[0]?.provenance?.state).toBe('intrinsic-only')
    })

    it('keeps same-id subgraphs from two sources distinct (collision-safe)', () => {
      const a: SnapshotEntry = {
        sourceId: 'src-a:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'a',
              label: 'a',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1' },
              parent: 'sg-2',
            },
          ],
          subgraphs: [{ id: 'sg-2', label: 'Source A rack' }],
        },
      }
      const b: SnapshotEntry = {
        sourceId: 'netbox:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'b',
              label: 'b',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.2' },
              parent: 'sg-2',
            },
          ],
          subgraphs: [{ id: 'sg-2', label: 'NetBox site' }],
        },
      }
      const out = resolve(emptyGraph(), [a, b])
      const ids = out.subgraphs?.map((s) => s.id) ?? []
      expect(ids).toContain('src-a:1:sg-2')
      expect(ids).toContain('netbox:1:sg-2')
      expect(new Set(ids).size).toBe(2)
      const parentByLabel = new Map(out.nodes.map((n) => [n.label, n.parent]))
      expect(parentByLabel.get('a')).toBe('src-a:1:sg-2')
      expect(parentByLabel.get('b')).toBe('netbox:1:sg-2')
    })

    it('namespaces nested subgraph parent/children refs together', () => {
      const snap: SnapshotEntry = {
        sourceId: 'src-a:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          // A node in the leaf keeps the rack→site chain (empty regions prune).
          nodes: [{ id: 'n', label: 'N', identity: { mgmtIp: '10.0.0.1' }, parent: 'rack' }],
          subgraphs: [
            { id: 'site', label: 'Site', children: ['rack'] },
            { id: 'rack', label: 'Rack', parent: 'site' },
          ],
        },
      }
      const out = resolve(emptyGraph(), [snap])
      const site = out.subgraphs?.find((s) => s.label === 'Site')
      const rack = out.subgraphs?.find((s) => s.label === 'Rack')
      expect(site?.id).toBe('src-a:1:site')
      expect(site?.children).toEqual(['src-a:1:rack'])
      expect(rack?.id).toBe('src-a:1:rack')
      expect(rack?.parent).toBe('src-a:1:site')
    })

    it('leaves intrinsic subgraph ids raw, and intrinsic parent wins on a shared node', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'r1',
            label: 'R1',
            shape: 'rect',
            identity: { mgmtIp: '10.0.0.1' },
            parent: 'intrinsic-sg',
          },
        ],
        subgraphs: [{ id: 'intrinsic-sg', label: 'Authored group' }],
      }
      const snap: SnapshotEntry = {
        sourceId: 'src-a:1',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            {
              id: 'x',
              label: 'R1',
              shape: 'rect',
              identity: { mgmtIp: '10.0.0.1' },
              parent: 'sg-2',
            },
          ],
          subgraphs: [{ id: 'sg-2', label: 'Source A group' }],
        },
      }
      const out = resolve(intrinsic, [snap])
      const ids = out.subgraphs?.map((s) => s.id) ?? []
      expect(ids).toContain('intrinsic-sg') // raw — intrinsic owns the id space
      // same identity (10.0.0.1) clusters into one node; intrinsic parent wins →
      // the source group sg-2 ends up empty and is pruned (no floating box).
      expect(ids).not.toContain('src-a:1:sg-2')
      const r1 = out.nodes.find((n) => n.label === 'R1')
      expect(r1?.parent).toBe('intrinsic-sg')
      expect(out.subgraphs?.find((s) => s.id === 'intrinsic-sg')?.provenance?.source).toBe(
        'intrinsic',
      )
    })

    it('prunes empty subgraphs but keeps non-empty ones nested (no floating boxes)', () => {
      // Pod has no direct members; only its leaf 5Y has a node. Stage is fully
      // empty. Result: Stage pruned; 5Y + its ancestor Pod kept and nested.
      const snap: SnapshotEntry = {
        sourceId: 'src',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'n', label: 'sw', identity: { mgmtIp: '10.0.0.1' }, parent: 'rack5y' }],
          subgraphs: [
            { id: 'pod', label: 'Pod' },
            { id: 'rack5y', label: '5Y', parent: 'pod' },
            { id: 'stage', label: 'Stage' }, // fully empty → pruned
            { id: 'rack6y', label: '6Y', parent: 'pod' }, // empty leaf → pruned
          ],
        },
      }
      const out = resolve(emptyGraph(), [snap])
      const labels = (out.subgraphs ?? []).map((s) => s.label).sort()
      expect(labels).toEqual(['5Y', 'Pod']) // Stage + 6Y pruned
      const rack = out.subgraphs?.find((s) => s.label === '5Y')
      expect(rack?.parent).toBe('src:pod') // still nested under its kept ancestor
    })
  })

  describe('regions (identity merge + membership)', () => {
    it('merges same-identity subgraphs from two sources into one region', () => {
      const a: SnapshotEntry = {
        sourceId: 'src-a',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'a1', label: 'a', identity: { mgmtIp: '10.0.0.1' }, parent: 'g' }],
          subgraphs: [{ id: 'g', label: 'Backbone', identity: { name: 'backbone' } }],
        },
      }
      const b: SnapshotEntry = {
        sourceId: 'netbox',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'b1', label: 'b', identity: { mgmtIp: '10.0.0.2' }, parent: 'g' }],
          subgraphs: [
            {
              id: 'g',
              label: 'Backbone DC',
              identity: { name: 'backbone', keys: { 'netbox-site': 'bb' } },
            },
          ],
        },
      }
      const out = resolve(emptyGraph(), [a, b])
      // one merged region (identity name=backbone matched across the two sources)
      expect(out.subgraphs).toHaveLength(1)
      const region = out.subgraphs?.[0]
      expect(region?.identity?.name).toBe('backbone')
      expect(region?.identity?.keys).toEqual({ 'netbox-site': 'bb' })
      // both nodes' parents collapse to the one canonical region id
      const parents = new Set(out.nodes.map((n) => n.parent))
      expect(parents.size).toBe(1)
      expect(parents.has(region?.id)).toBe(true)
    })

    it('assigns a parentless node to a region by subnet membership', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        subgraphs: [
          { id: 'dc', label: 'DC', membership: [{ attr: 'subnet', value: '10.0.0.0/24' }] },
        ],
      }
      const snap: SnapshotEntry = {
        sourceId: 'src',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'in', label: 'in', identity: { mgmtIp: '10.0.0.5' } },
            { id: 'out', label: 'out', identity: { mgmtIp: '10.9.0.5' } },
          ],
        },
      }
      const out = resolve(intrinsic, [snap])
      expect(out.nodes.find((n) => n.label === 'in')?.parent).toBe('dc')
      expect(out.nodes.find((n) => n.label === 'out')?.parent).toBeUndefined()
    })

    it('assigns by name-regex membership; explicit parent is never overridden', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        subgraphs: [
          { id: 'routers', label: 'Routers', membership: [{ attr: 'name', value: '^mx' }] },
          { id: 'kept', label: 'Kept' },
        ],
      }
      const snap: SnapshotEntry = {
        sourceId: 'src',
        capturedAt: 1000,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'm', label: 'mx99', identity: { mgmtIp: '10.0.0.1' } },
            // already parented (to a namespaced source group) → criteria must not touch it
            { id: 'p', label: 'mx88', identity: { mgmtIp: '10.0.0.2' }, parent: 'own' },
          ],
          subgraphs: [{ id: 'own', label: 'Own' }],
        },
      }
      const out = resolve(intrinsic, [snap])
      expect(out.nodes.find((n) => n.label === 'mx99')?.parent).toBe('routers')
      expect(out.nodes.find((n) => n.label === 'mx88')?.parent).toBe('src:own')
    })
  })

  describe('composition modes (link anchor + scope)', () => {
    const twoNodes = () => [
      { id: 'n1', label: 'R1', identity: { mgmtIp: '10.0.0.1' }, ports: [pt('p1', 'e0')] },
      { id: 'n2', label: 'R2', identity: { mgmtIp: '10.0.0.2' }, ports: [pt('p2', 'e1')] },
    ]
    const pt = (id: string, ifName: string) => ({
      id,
      label: ifName,
      connectors: [],
      identity: { ifName },
    })
    const linkN1N2 = (extra: Record<string, unknown>) => ({
      from: { node: 'n1', port: 'p1' },
      to: { node: 'n2', port: 'p2' },
      ...extra,
    })

    it('an anchor (update-only) link alone creates no edge', () => {
      const snap: SnapshotEntry = {
        sourceId: 's',
        capturedAt: 1,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: twoNodes(),
          links: [linkN1N2({ presence: 'anchor' })] as NetworkGraph['links'],
        },
      }
      const out = resolve(emptyGraph(), [snap])
      expect(out.links).toHaveLength(0)
    })

    it('an anchor link updates fields of a scooped link instead of adding one', () => {
      const scoop: SnapshotEntry = {
        sourceId: 'topo',
        capturedAt: 1,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: twoNodes(),
          links: [linkN1N2({})] as NetworkGraph['links'],
        },
      }
      const update: SnapshotEntry = {
        sourceId: 'deps',
        capturedAt: 2,
        priority: 5,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: twoNodes(),
          links: [linkN1N2({ presence: 'anchor', vlan: [42] })] as NetworkGraph['links'],
        },
      }
      const out = resolve(emptyGraph(), [scoop, update])
      expect(out.links).toHaveLength(1)
      expect(out.links[0]?.vlan).toEqual([42])
      expect(out.links[0]?.presence).toBeUndefined() // input-only, never emitted
    })

    it('top-priority source defines the scope; a lower source is confined to it', () => {
      // A (priority 1) is the highest-priority source → its region is the closed
      // world (ordering-driven, no explicit flag). B (priority 0) is confined:
      // its node that matches A's region membership is kept (fills the scope),
      // the out-of-range one is dropped. A's own node is always kept.
      const scoping: SnapshotEntry = {
        sourceId: 'A',
        capturedAt: 1,
        priority: 1,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'a1', label: 'in-region', identity: { mgmtIp: '10.0.0.1' }, parent: 'g' }],
          subgraphs: [
            { id: 'g', label: 'Region', membership: [{ attr: 'subnet', value: '10.0.0.0/24' }] },
          ],
        },
      }
      const additive: SnapshotEntry = {
        sourceId: 'B',
        capturedAt: 1,
        priority: 0,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'b1', label: 'fills-region', identity: { mgmtIp: '10.0.0.9' } }, // matches subnet
            { id: 'b2', label: 'out', identity: { mgmtIp: '10.9.0.9' } }, // outside → dropped
          ],
        },
      }
      const out = resolve(emptyGraph(), [scoping, additive])
      expect(out.nodes.map((n) => n.label).sort()).toEqual(['fills-region', 'in-region'])
    })

    it('scope is region-centric: the scope source’s own out-of-region nodes drop', () => {
      // Scope = the source's REGIONS, not everything it emits. A node IN the
      // region is kept; the source's own peripheral node that is in NO region
      // (e.g. a Zabbix LLDP external neighbor, outside the fetched host group)
      // is OUT of scope and dropped.
      const scoping: SnapshotEntry = {
        sourceId: 'A',
        capturedAt: 1,
        priority: 1,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [
            { id: 'in', label: 'in-region', identity: { mgmtIp: '10.0.0.1' }, parent: 'g' },
            { id: 'ext', label: 'external-neighbor', identity: { sysName: 'peer' } }, // no region
          ],
          subgraphs: [{ id: 'g', label: 'Region' }],
        },
      }
      const out = resolve(emptyGraph(), [scoping])
      expect(out.nodes.map((n) => n.label)).toEqual(['in-region'])
    })

    it('an intrinsic (curated) node is never dropped by scope', () => {
      const intrinsic: NetworkGraph = {
        ...emptyGraph(),
        nodes: [{ id: 'op', label: 'operator-placed', identity: { mgmtIp: '10.9.0.1' } }],
      }
      // A scope-defining source whose region does NOT contain the intrinsic node.
      const scoping: SnapshotEntry = {
        sourceId: 'A',
        capturedAt: 1,
        priority: 1,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'a1', label: 'a1', identity: { mgmtIp: '10.0.0.1' }, parent: 'g' }],
          subgraphs: [{ id: 'g', label: 'Region' }],
        },
      }
      const out = resolve(intrinsic, [scoping])
      expect(out.nodes.map((n) => n.label).sort()).toEqual(['a1', 'operator-placed'])
    })

    it('no scope when sources contribute no regions (open-world union)', () => {
      const a: SnapshotEntry = {
        sourceId: 'A',
        capturedAt: 1,
        priority: 1,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'a1', label: 'a', identity: { mgmtIp: '10.0.0.1' } }],
        },
      }
      const b: SnapshotEntry = {
        sourceId: 'B',
        capturedAt: 1,
        priority: 0,
        status: 'ok',
        graph: {
          ...emptyGraph(),
          nodes: [{ id: 'b1', label: 'b', identity: { mgmtIp: '10.9.0.1' } }],
        },
      }
      const out = resolve(emptyGraph(), [a, b])
      // no regions → no closed scope → both kept (union)
      expect(out.nodes.map((n) => n.label).sort()).toEqual(['a', 'b'])
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
