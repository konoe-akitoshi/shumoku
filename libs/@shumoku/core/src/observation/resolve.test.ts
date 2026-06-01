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

    it('a policy-only overlay does NOT wipe an observed access attachment', () => {
      // network-scan stamps the community it read with as an observed access
      // attachment. An authored overlay that only sets a policy must merge in,
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
      const authored: NetworkGraph = {
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
      const n = resolve(authored, [observedWithAccess]).nodes[0]
      const acc = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      expect(
        acc && acc.kind === 'access' && acc.protocol === 'snmp' ? acc.community : undefined,
      ).toBe('public') // observed community survived
      expect((n?.attachments ?? []).some((a) => a.kind === 'policy')).toBe(true) // authored applied
    })

    it('an authored access overrides an observed access of the same protocol', () => {
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
      const authored: NetworkGraph = {
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
      const n = resolve(authored, [observedWithAccess]).nodes[0]
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

    it('a multi-key exclusion still matches when one key changed (ANY, not ALL)', () => {
      // Hide is stored with all available keys; a later sysName rename must not
      // silently un-hide the node — mgmtIp still matches.
      const snap: SnapshotEntry = makeSnap('network-scan:1', 1000, [
        { id: 'a', label: 'junk', identity: { mgmtIp: '10.0.0.5', sysName: 'new-name' } },
      ])
      const authored: NetworkGraph = {
        ...emptyGraph(),
        exclusions: [{ mgmtIp: '10.0.0.5', sysName: 'old-name' }],
      }
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

  // -------------------------------------------------------------------------
  // Priority field merge — the heart of the redesign. All sources (incl. the
  // human/authored graph) are equal, priority-ordered contributions; per
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

    it('human (authored) outranks every observed source per field', () => {
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
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [
          {
            id: 'discovered:0',
            label: 'HUMAN-RENAME',
            identity: { mgmtIp: '10.0.0.1' },
          },
        ],
      }
      const n = resolve(authored, [lo]).nodes[0]
      // human wins label (it holds one) — "human wins" = "+Infinity priority"
      expect(stringOf(n?.label)).toBe('HUMAN-RENAME')
      expect(n?.fieldSources?.['label']).toBe('authored')
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
      const authored: NetworkGraph = {
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
      const n = resolve(authored, [observed]).nodes[0]
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
      const authored: NetworkGraph = {
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
      const n = resolve(authored, [observed]).nodes[0]
      const snmp = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'snmp')
      const ssh = (n?.attachments ?? []).find((a) => a.kind === 'access' && a.protocol === 'ssh')
      // observed access is attributed to the observing source (UI: read-only)
      expect(snmp?.provenance?.source).toBe('network-scan:1')
      // human access is attributed to 'authored' (UI: editable / ✕)
      expect(ssh?.provenance?.source).toBe('authored')
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
      const authored: NetworkGraph = {
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
      const n = resolve(authored, [observed]).nodes[0]
      const accs = (n?.attachments ?? []).filter(
        (a) => a.kind === 'access' && a.protocol === 'snmp',
      )
      expect(accs).toHaveLength(1)
      const a = accs[0]
      expect(a && a.kind === 'access' && a.protocol === 'snmp' ? a.community : undefined).toBe(
        'override',
      )
      expect(a?.provenance?.source).toBe('authored')
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
      expect(n?.fieldSources?.['label']).toBe('authored')
    })

    it('dropping the human contribution returns the node to the observed name + community', () => {
      // Reset = the node's entry is gone from the authored graph.
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
      const authored: NetworkGraph = {
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
      const out = resolve(authored, [other])
      const disabled = out.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.9')
      expect(disabled).toBeDefined()
      expect(disabled?.provenance?.state).toBe('authored-only')
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
      const authored: NetworkGraph = {
        ...emptyGraph(),
        nodes: [{ id: 'kept', label: 'kept', identity: { mgmtIp: '10.0.0.1' } }],
      }
      const ips = resolve(authored, [latest])
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
