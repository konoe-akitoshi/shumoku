// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { ingestNetwork } from '../../src/services/contribution-store.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { getDatabase, setupTempDb, sourceOf, type TempDb, writeAuthored } from './helper.ts'

let db_: TempDb
let svc: TopologyService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => db_.teardown())

const g = (nodeId: string): NetworkGraph =>
  ({
    version: '1',
    name: 'manual',
    nodes: [{ id: nodeId, label: nodeId, shape: 'rect', identity: { mgmtIp: '10.0.0.1' } }],
    links: [],
  }) as NetworkGraph

const nullAttachmentRows = (topologyId?: string): number =>
  (
    getDatabase()
      .query(
        `SELECT COUNT(*) AS c FROM contribution_source
         WHERE attachment_id IS NULL AND (? IS NULL OR topology_id = ?)`,
      )
      .get(topologyId ?? null, topologyId ?? null) as { c: number }
  ).c

describe('every contribution belongs to an attached source', () => {
  test('ingestNetwork refuses a contribution with no attachment', async () => {
    const topo = await svc.create({ name: 'm1' })
    expect(() =>
      ingestNetwork(topo.id, 'intrinsic', sourceOf(g('a')), {
        attachmentId: null as unknown as string,
      }),
    ).toThrow(/attachmentId/)
    expect(nullAttachmentRows(topo.id)).toBe(0)
  })

  test('the one-per-topology overlay index is gone', () => {
    const idx = getDatabase()
      .query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get('idx_contrib_one_intrinsic')
    expect(idx).toBeNull()
  })

  test('a stand-in authored source is a Manual data source with an attachment', async () => {
    const topo = await svc.create({ name: 'm2' })
    await writeAuthored(svc, topo.id, sourceOf(g('a')))
    expect(nullAttachmentRows(topo.id)).toBe(0)
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })
})

describe('Manual = an explicitly-added, ordinary hand-drawn source (same save path)', () => {
  test('a Manual source save records an observation that materializes like any source', async () => {
    const topo = await svc.create({ name: 'ms2' })
    const { dataSourceId } = await svc.attachManualSource(topo.id, 'topology')
    // The editor save goes through the SAME path as every source: record an
    // observation (the human is the "scanner") → materializeContribution.
    const observations = new ObservationsService()
    await observations.record({
      topologyId: topo.id,
      sourceId: dataSourceId,
      capturedAt: 1,
      status: 'ok',
      source: sourceOf(g('hand')),
    })

    const src = getDatabase()
      .query(
        'SELECT attachment_id FROM contribution_source WHERE topology_id = ? AND source_id = ?',
      )
      .get(topo.id, dataSourceId) as { attachment_id: string | null } | undefined
    expect(src?.attachment_id).not.toBeNull()
    expect(nullAttachmentRows(topo.id)).toBe(0)

    // It folds into the resolved graph as an ordinary source.
    const parsed = await svc.getParsed(topo.id)
    expect(parsed?.graph.nodes.some((n) => n.identity?.mgmtIp === '10.0.0.1')).toBe(true)
  })
})

describe('display settings are columns of the topology', () => {
  test('hide_disconnected defaults off, round-trips, and re-bakes the topology', async () => {
    const topo = await svc.create({ name: 'ds1' })
    expect(svc.getHideDisconnected(topo.id)).toBe(false)
    const revision = () =>
      (
        getDatabase()
          .query('SELECT composition_revision AS r FROM topologies WHERE id = ?')
          .get(topo.id) as { r: number }
      ).r
    const before = revision()
    svc.setHideDisconnected(topo.id, true)
    expect(svc.getHideDisconnected(topo.id)).toBe(true)
    expect(revision()).toBeGreaterThan(before)
    expect(svc.collectDeriveInputs(topo.id)?.hideDisconnected).toBe(true)
    svc.setHideDisconnected(topo.id, false)
    expect(svc.collectDeriveInputs(topo.id)?.hideDisconnected).toBe(false)
  })

  test('the project input is an empty model carrying only the name', async () => {
    const topo = await svc.create({ name: 'ds2' })
    const inputs = svc.collectDeriveInputs(topo.id)
    expect(inputs?.project.config).toEqual({ name: 'ds2', nodes: [], links: [] })
    expect(inputs?.project.observation).toBeUndefined()
    expect(inputs?.project.drawing).toBeUndefined()
  })
})
