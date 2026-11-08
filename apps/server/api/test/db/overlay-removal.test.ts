// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The startup step that removes the hidden project overlay (project-overlay-removal.ts).
 *
 * The fixture is a database as 0.3.0-beta.1 or 0.2.x left it: a scanned topology whose
 * overlay holds a rename (the device has a management address), a hide (the device is known
 * only by its chassis id), a hide that points at nothing, anchor nodes and ports left by
 * metrics bindings, a metrics binding that has not been moved to `metrics_mapping` yet, an
 * `edgeStyle`, and `hideDisconnected`. It runs in the order server.ts runs the steps.
 *
 * Run with: cd apps/server/api && bun test test/db/overlay-removal.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Attachment, SourceNetwork } from '@shumoku/core'
import { buildNetwork } from '../../src/services/contribution-store.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import {
  attachSource,
  getDatabase,
  insertDataSource,
  setupTempDb,
  type TempDb,
  writeLegacyOverlay,
} from './helper.ts'

let tmp: TempDb
let svc: TopologyService
beforeAll(() => {
  tmp = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => tmp.teardown())

const db = () => getDatabase()
const one = <T>(sql: string, ...params: (string | number)[]): T | undefined =>
  db()
    .query(sql)
    .get(...params) as T | undefined
const count = (sql: string, ...params: (string | number)[]): number =>
  one<{ c: number }>(sql, ...params)?.c ?? 0

const scan = (topologyId: string, sourceId: string, nodes: object[], links: object[] = []) =>
  new ObservationsService().record({
    topologyId,
    sourceId,
    capturedAt: Date.now(),
    status: 'ok',
    source: {
      network: { nodes: nodes as never, links: links as never },
      observation: {
        nodes: Object.fromEntries(
          nodes.flatMap((n) => {
            const { id, identity } = n as { id: string; identity?: object }
            return identity ? [[id, { identity }]] : []
          }),
        ),
      },
    },
  })

describe('removeProjectOverlays', () => {
  let topologyId = ''
  let emptyId = ''
  let handId = ''
  let metricsId = ''
  const logs: string[] = []
  const realLog = console.log

  beforeAll(async () => {
    // --- the topology with a scan, a metrics source and a busy overlay -----------------------
    const topo = await svc.create({ name: 'Campus' })
    topologyId = topo.id
    const scanner = insertDataSource('lldp', 'scanner')
    attachSource(topologyId, scanner, 'topology')
    metricsId = insertDataSource('zabbix', 'zbx')
    attachSource(topologyId, metricsId, 'metrics')
    await scan(
      topologyId,
      scanner,
      [
        { id: 'core', label: 'core-sw', identity: { mgmtIp: '10.0.0.1', sysName: 'core-sw' } },
        { id: 'tenant', label: 'tenant-sw', identity: { chassisId: 'aa:bb:cc:00:00:09' } },
        { id: 'edge', label: 'edge-sw', identity: { mgmtIp: '10.0.0.3', sysName: 'edge-sw' } },
      ],
      [
        {
          endpoints: [
            { node: 'core', port: 'e0' },
            { node: 'edge', port: 'e1' },
          ],
        },
        {
          endpoints: [
            { node: 'core', port: 'e2' },
            { node: 'tenant', port: 'e3' },
          ],
        },
      ],
    )

    const binding = {
      kind: 'metrics-binding',
      sourceId: metricsId,
      hostId: '42',
      hostName: 'edge-sw',
    } as Attachment
    const overlay: SourceNetwork = {
      network: {
        name: 'Campus',
        nodes: [
          { id: 'ov-core', label: 'Core Switch' }, // a rename
          { id: 'ov-edge', label: '' }, // an anchor hosting a metrics binding
          { id: 'ov-ghost', label: '' }, // a pure anchor
        ],
        links: [],
      },
      observation: {
        nodes: {
          'ov-core': { identity: { mgmtIp: '10.0.0.1' } },
          'ov-edge': {
            identity: { mgmtIp: '10.0.0.3' },
            attachments: [binding],
            ports: { 'Gi0/1': { identity: { ifName: 'Gi0/1' } } },
          },
          'ov-ghost': {
            identity: { mgmtIp: '10.9.9.9' },
            ports: {
              'Gi0/1': { identity: { ifName: 'Gi0/1' } },
              'Gi0/2': { identity: { ifName: 'Gi0/2' } },
            },
          },
        },
        // A hide with only a chassis id, and one that points at nothing.
        exclusions: [{ chassisId: 'aa:bb:cc:00:00:09' }, { sysName: 'not-there' }],
      },
      drawing: { settings: { hideDisconnected: true, edgeStyle: 'orthogonal' } },
    } as unknown as SourceNetwork
    writeLegacyOverlay(topologyId, overlay)

    // --- an overlay of nothing but anchors: no Manual source may come of it ---------------------
    emptyId = (await svc.create({ name: 'Empty' })).id
    writeLegacyOverlay(emptyId, {
      network: { name: 'Empty', nodes: [{ id: 'a', label: '' }], links: [] },
      observation: { nodes: { a: { identity: { mgmtIp: '10.7.0.1' } } } },
    } as unknown as SourceNetwork)

    // --- a hand-drawn overlay (a network of its own nodes) ---------------------------------------
    handId = (await svc.create({ name: 'Hand' })).id
    writeLegacyOverlay(handId, {
      network: {
        name: 'Hand',
        nodes: [
          { id: 'r1', label: 'Router' },
          { id: 'r2', label: 'Switch' },
        ],
        links: [
          {
            endpoints: [
              { node: 'r1', port: 'e0' },
              { node: 'r2', port: 'e1' },
            ],
          },
        ],
      },
    } as unknown as SourceNetwork)

    // The server order: metrics-mapping backfill first, then the overlay removal.
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '))
    }
    try {
      await svc.backfillMetricsMappingRows()
      await svc.removeProjectOverlays()
    } finally {
      console.log = realLog
    }
  })

  test('no contribution is left without an attached owner', () => {
    expect(count('SELECT COUNT(*) AS c FROM contribution_source WHERE attachment_id IS NULL')).toBe(
      0,
    )
    expect(
      count("SELECT COUNT(*) AS c FROM contribution_source WHERE source_id = 'intrinsic'"),
    ).toBe(0)
    expect(count("SELECT COUNT(*) AS c FROM entity_element WHERE source_id = 'intrinsic'")).toBe(0)
    expect(
      count("SELECT COUNT(*) AS c FROM entity_identity_key WHERE source_id = 'intrinsic'"),
    ).toBe(0)
  })

  test('hideDisconnected moved to the topology column', () => {
    expect(svc.getHideDisconnected(topologyId)).toBe(true)
    expect(svc.getHideDisconnected(emptyId)).toBe(false)
    expect(svc.collectDeriveInputs(topologyId)?.hideDisconnected).toBe(true)
  })

  test('the metrics binding survived in metrics_mapping, before the overlay went', () => {
    expect(
      count(
        "SELECT COUNT(*) AS c FROM metrics_mapping WHERE topology_id = ? AND kind = 'node'",
        topologyId,
      ),
    ).toBe(1)
  })

  test('renames and hides became one Manual source named "<topology> edits", on top', () => {
    const sources = db()
      .query(
        `SELECT ds.id AS id, ds.name AS name, ds.type AS type, tds.priority AS priority
         FROM topology_data_sources tds JOIN data_sources ds ON ds.id = tds.data_source_id
         WHERE tds.topology_id = ? AND tds.purpose = 'topology' ORDER BY tds.priority`,
      )
      .all(topologyId) as { id: string; name: string; type: string; priority: number }[]
    expect(sources.map((s) => s.name)).toEqual(['lldp', 'Campus edits'])
    const manual = sources[1]
    expect(manual?.type).toBe('manual')
    expect(manual?.priority).toBe((sources[0]?.priority ?? 0) + 1)

    const net = buildNetwork(topologyId, manual?.id ?? '')?.network
    expect(net?.nodes).toHaveLength(2)
    // `{ id, label }` and `{ id, absent: true }` only: no address, no other field.
    const renamed = net?.nodes.find((n) => n.label === 'Core Switch')
    const hidden = net?.nodes.find((n) => (n as { absent?: true }).absent)
    expect(Object.keys(renamed ?? {}).sort()).toEqual(['id', 'label'])
    expect(Object.keys(hidden ?? {}).sort()).toEqual(['absent', 'id'])
    // Readable ids: a slug of the rename's label, or of the name the device is known by.
    expect(renamed?.id).toBe('core-switch')
    expect(hidden?.id).toBe('tenant-sw')
    // The registry key is claimed under the id written in the YAML.
    const keyed = db()
      .query("SELECT value FROM entity_identity_key WHERE key = ? AND kind = 'node'")
      .all(`manual:${manual?.id}`) as { value: string }[]
    expect(keyed.map((k) => k.value).sort()).toEqual(['core-switch', 'tenant-sw'])
  })

  test('the rename and the hide land on the scanned devices; the binding device stays', async () => {
    const graph = (await svc.getParsed(topologyId))?.graph
    const names = (graph?.nodes ?? []).map((n) => n.label).sort()
    // core-sw is renamed, tenant-sw (chassis id only, no address) is gone, edge-sw is unchanged.
    expect(names).toEqual(['Core Switch', 'edge-sw'])
    const core = graph?.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.1')
    expect(core?.label).toBe('Core Switch')
    // Nothing was minted twice: the 3 scanned devices, plus the one entity the overlay's own
    // anchor node (10.9.9.9) had minted, which stays as an unreferenced registry row.
    expect(
      count(
        "SELECT COUNT(*) AS c FROM entity_registry WHERE topology_id = ? AND kind = 'node'",
        topologyId,
      ),
    ).toBe(4)
  })

  test('an overlay of anchors only creates no Manual source', () => {
    expect(
      count('SELECT COUNT(*) AS c FROM topology_data_sources WHERE topology_id = ?', emptyId),
    ).toBe(0)
    expect(count("SELECT COUNT(*) AS c FROM data_sources WHERE type = 'manual'")).toBe(2)
  })

  test('a hand-drawn network moves as it is into a Manual source', async () => {
    const manual = one<{ id: string }>(
      `SELECT ds.id AS id FROM topology_data_sources tds
       JOIN data_sources ds ON ds.id = tds.data_source_id WHERE tds.topology_id = ?`,
      handId,
    )
    expect(manual).toBeDefined()
    const net = buildNetwork(handId, manual?.id ?? '')?.network
    expect(net?.nodes.map((n) => n.id).sort()).toEqual(['r1', 'r2'])
    expect(net?.links).toHaveLength(1)
    const graph = (await svc.getParsed(handId))?.graph
    expect(graph?.nodes.map((n) => n.label).sort()).toEqual(['Router', 'Switch'])
    expect(graph?.links).toHaveLength(1)
  })

  test('the composition revision moved, and what could not be tied to a device is logged by id', () => {
    const line = logs.find((l) => l.startsWith('[Overlay]')) ?? ''
    expect(line).toContain('removed the project overlay from 3 topolog')
    expect(line).toContain('2 Manual source(s) created')
    expect(line).toContain('1 rename(s), 1 hide(s)')
    expect(line).toContain('1 could not be tied to a device')
    expect(line).toContain(`${topologyId}:exclusion[1]`)
    // Names and addresses never reach the log.
    expect(line).not.toContain('not-there')
    expect(line).not.toContain('10.0.0')
  })

  test('it runs once: the guard is set and a second call changes nothing', async () => {
    expect(
      one<{ value: string }>("SELECT value FROM settings WHERE key = 'project_overlay_removed'")
        ?.value,
    ).toBe('1')
    const before = count('SELECT COUNT(*) AS c FROM data_sources')
    await svc.removeProjectOverlays()
    expect(count('SELECT COUNT(*) AS c FROM data_sources')).toBe(before)
  })
})

describe('removeProjectOverlays defers what the metrics backfill could not move', () => {
  test('a topology whose bindings are still pending keeps its overlay and the guard stays unset', async () => {
    db().query("DELETE FROM settings WHERE key = 'project_overlay_removed'").run()
    const topo = await svc.create({ name: 'Pending' })
    const metrics = insertDataSource('zabbix', 'zbx_pending')
    attachSource(topo.id, metrics, 'metrics')
    writeLegacyOverlay(topo.id, {
      network: { name: 'Pending', nodes: [{ id: 'x', label: '' }], links: [] },
      observation: {
        nodes: {
          x: {
            identity: { mgmtIp: '10.4.0.1' },
            attachments: [
              { kind: 'metrics-binding', sourceId: metrics, hostId: '1' } as Attachment,
            ],
          },
        },
      },
    } as unknown as SourceNetwork)
    // Not resolvable this run (no backfill executed for it), so the overlay must stay.
    ;(svc as unknown as { overlayBindingsDeferred: Set<string> }).overlayBindingsDeferred.add(
      topo.id,
    )
    await svc.removeProjectOverlays()
    expect(
      count(
        "SELECT COUNT(*) AS c FROM contribution_source WHERE topology_id = ? AND source_id = 'intrinsic'",
        topo.id,
      ),
    ).toBe(1)
    expect(
      one<{ value: string }>("SELECT value FROM settings WHERE key = 'project_overlay_removed'") ??
        undefined,
    ).toBeUndefined()
  })
})
