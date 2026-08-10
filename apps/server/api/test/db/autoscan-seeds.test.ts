// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Seeds for the deep-read pass.
 *
 * A credential-free sweep can say what is at an address; only a credentialed
 * read can say what that device sees. So the scanner has to be told which
 * addresses are worth reading, and the useful answer is "every address the
 * topology now knows" — including ones no operator ever typed, because another
 * source identified the device and composition supplied its address.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { NetworkGraph } from '@shumoku/core'
import { ObservationsService } from '../../src/services/observations.ts'
import { resolveSeedsForAutoscan } from '../../src/services/sync-scheduler.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { attachSource, insertDataSource, setupTempDb, type TempDb } from './helper.ts'

let db_: TempDb
let svc: TopologyService
let obs: ObservationsService
beforeAll(() => {
  db_ = setupTempDb()
  svc = new TopologyService()
  obs = new ObservationsService()
})
afterAll(() => db_.teardown())

function graphWith(nodes: Array<{ id: string; mgmtIp?: string; mac?: string }>): NetworkGraph {
  return {
    version: '1',
    name: 't',
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.id,
      shape: 'rect',
      identity: {
        ...(n.mgmtIp ? { mgmtIp: n.mgmtIp } : {}),
        ...(n.mac ? { mac: n.mac } : {}),
      },
    })),
    links: [],
  } as NetworkGraph
}

describe('resolveSeedsForAutoscan', () => {
  test('returns every management address the topology knows, deduplicated', async () => {
    const topo = await svc.create({ name: 'seeds-basic' })
    const src = insertDataSource('network-scan', 'scan_seeds_basic')
    attachSource(topo.id, src, 'topology')
    await obs.record({
      topologyId: topo.id,
      sourceId: src,
      capturedAt: 1000,
      status: 'ok',
      graph: graphWith([
        { id: 'a', mgmtIp: '172.16.254.208' },
        { id: 'b', mgmtIp: '172.16.254.209' },
      ]),
    })

    expect(resolveSeedsForAutoscan(topo.id).sort()).toEqual(['172.16.254.208', '172.16.254.209'])
  })

  test('a device with no address contributes no seed', async () => {
    // This is the wireless-controller case: an uplink switch known only by its
    // LLDP chassis MAC. Unreachable until some other source supplies an
    // address, and it must not turn into a bogus target in the meantime.
    const topo = await svc.create({ name: 'seeds-macless' })
    const src = insertDataSource('huawei-nce-campus', 'nce_seeds_macless')
    attachSource(topo.id, src, 'topology')
    await obs.record({
      topologyId: topo.id,
      sourceId: src,
      capturedAt: 1000,
      status: 'ok',
      graph: graphWith([
        { id: 'sw', mac: 'cc:d8:1f:9f:d4:ab' },
        { id: 'ap', mgmtIp: '172.16.253.100', mac: '50:04:01:01:d5:50' },
      ]),
    })

    expect(resolveSeedsForAutoscan(topo.id)).toEqual(['172.16.253.100'])
  })

  test('two sources describing one device yield a single seed', async () => {
    // The whole point of the merge: the sweep found an address, the controller
    // knew the MAC. Seeding must not scan the same box twice.
    const topo = await svc.create({ name: 'seeds-merge' })
    const nce = insertDataSource('huawei-nce-campus', 'nce_seeds_merge')
    const scan = insertDataSource('network-scan', 'scan_seeds_merge')
    attachSource(topo.id, nce, 'topology')
    attachSource(topo.id, scan, 'topology')
    await obs.record({
      topologyId: topo.id,
      sourceId: nce,
      capturedAt: 1000,
      status: 'ok',
      graph: graphWith([{ id: 'sw', mgmtIp: '172.16.254.208', mac: 'cc:d8:1f:9f:d4:ab' }]),
    })
    await obs.record({
      topologyId: topo.id,
      sourceId: scan,
      capturedAt: 1000,
      status: 'ok',
      graph: graphWith([{ id: 'scan:sw', mgmtIp: '172.16.254.208', mac: 'cc:d8:1f:9f:d4:ab' }]),
    })

    expect(resolveSeedsForAutoscan(topo.id)).toEqual(['172.16.254.208'])
  })

  test('an unknown topology seeds nothing rather than throwing', () => {
    expect(resolveSeedsForAutoscan('no-such-topology')).toEqual([])
  })
})
