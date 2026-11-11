// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Who a read tries the credentials on (new devices and the lost-retry), how a
 * trial result lands on a device's row, and the derived device state.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { trialDevices } from '../../src/discovery/credential-trial.ts'
import {
  createCredential,
  credentialsForTrial,
  topologyClock,
  updateCredential,
} from '../../src/services/credentials.ts'
import {
  applyTrialResult,
  deriveDeviceState,
  listDeviceAccess,
  recordReadOutcomes,
  resolveTrialCandidates,
  setDeviceAccess,
} from '../../src/services/device-access.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { getDatabase, setupTempDb, type TempDb, timestamp } from './helper.ts'

let tmp: TempDb
let svc: TopologyService
beforeAll(() => {
  tmp = setupTempDb()
  svc = new TopologyService()
})
afterAll(() => tmp.teardown())

async function topologyWithNodes(name: string, count = 3) {
  const topo = await svc.create({ name })
  const now = timestamp()
  const nodes = Array.from({ length: count }, (_, i) => `${name}:n${i}`)
  const insert = getDatabase().query(
    `INSERT INTO entity_registry (id, topology_id, kind, status, first_seen_at, last_seen_at)
     VALUES (?, ?, 'node', 'active', ?, ?)`,
  )
  for (const id of nodes) insert.run(id, topo.id, now, now)
  return { id: topo.id, nodes }
}

function cred(topologyIds: string[], name: string, community = name) {
  const result = createCredential({ name, method: 'snmp', params: { community }, topologyIds })
  if ('error' in result) throw new Error(result.error)
  return result.credential
}

const addr = (i: number) => `10.9.0.${i + 1}`

describe('trial candidates', () => {
  test('only enabled devices with an address and no credential are candidates', async () => {
    const t = await topologyWithNodes('cand-basic', 4)
    const c = cred([t.id], 'cand-basic-cred')
    const [a, b, cc, d] = t.nodes as [string, string, string, string]
    setDeviceAccess(t.id, [b], { credentialId: c.id }) // already has one
    setDeviceAccess(t.id, [cc], { enabled: false }) // turned off
    const nodes = [
      { id: a, address: addr(0) },
      { id: b, address: addr(1) },
      { id: cc, address: addr(2) },
      { id: d }, // no address
    ]
    expect(resolveTrialCandidates(t.id, nodes).map((x) => x.entityId)).toEqual([a])
  })

  test('a topology that links no credential has nothing to try', async () => {
    const t = await topologyWithNodes('cand-none', 1)
    const nodes = [{ id: t.nodes[0] as string, address: addr(0) }]
    expect(resolveTrialCandidates(t.id, nodes)).toEqual([])
  })

  test('a device that answered none is skipped until the clock moves; force tries it anyway', async () => {
    const t = await topologyWithNodes('cand-silent', 1)
    const c = cred([t.id], 'cand-silent-cred')
    const [a] = t.nodes as [string]
    const nodes = [{ id: a, address: addr(0) }]

    applyTrialResult(t.id, { matched: [], silent: [a] }, Date.now() + 1000)
    expect(resolveTrialCandidates(t.id, nodes)).toEqual([])
    expect(resolveTrialCandidates(t.id, nodes, { force: true })).toHaveLength(1)

    updateCredential(c.id, { params: { community: 'cand-silent-rotated' } })
    getDatabase().query('UPDATE device_access SET tried_at = 1 WHERE entity_id = ?').run(a)
    expect(resolveTrialCandidates(t.id, nodes)).toHaveLength(1)
  })

  test('adding a link makes a silent device worth trying again', async () => {
    const t = await topologyWithNodes('cand-link', 1)
    cred([t.id], 'cand-link-1')
    const second = cred([], 'cand-link-2')
    const [a] = t.nodes as [string]
    const nodes = [{ id: a, address: addr(0) }]
    applyTrialResult(t.id, { matched: [], silent: [a] }, Date.now() + 1000)
    expect(resolveTrialCandidates(t.id, nodes)).toEqual([])
    getDatabase().query('UPDATE device_access SET tried_at = 1 WHERE entity_id = ?').run(a)
    updateCredential(second.id, { topologyIds: [t.id] })
    expect(topologyClock(t.id)).toBeGreaterThan(1)
    expect(resolveTrialCandidates(t.id, nodes)).toHaveLength(1)
  })
})

describe('lost retry', () => {
  /** Two credentials linked; a device that holds `held` and failed at `failedAt`. */
  async function lostDevice(name: string, failedAt: number) {
    const t = await topologyWithNodes(name, 1)
    const held = cred([t.id], `${name}-held`)
    const other = cred([t.id], `${name}-other`)
    const [a] = t.nodes as [string]
    setDeviceAccess(t.id, [a], { credentialId: held.id })
    recordReadOutcomes(t.id, [{ entityId: a, status: 'failed', error: 'timeout' }], failedAt)
    return { t, held, other, a, nodes: [{ id: a, address: addr(0) }] }
  }

  test('a lost device is retried with the OTHER credentials once the clock has moved past its failure', async () => {
    const { t, held, other, a, nodes } = await lostDevice('lost-retry', 1)
    const candidates = resolveTrialCandidates(t.id, nodes)
    expect(candidates).toEqual([{ entityId: a, address: addr(0), skipCredentialId: held.id }])

    const found = await trialDevices(
      candidates,
      credentialsForTrial(t.id),
      async (_ad, community) => {
        return community === 'lost-retry-other'
      },
    )
    expect(found.matched).toEqual([{ entityId: a, credentialId: other.id }])
    applyTrialResult(t.id, { matched: found.matched, silent: [] }, Date.now())
    expect(listDeviceAccess(t.id).get(a)).toMatchObject({
      credentialId: other.id,
      assignedBy: 'probe',
    })
  })

  test('not retried when the failure is newer than the clock, or there is no other credential', async () => {
    const fresh = await lostDevice('lost-fresh', Date.now() + 60_000)
    expect(resolveTrialCandidates(fresh.t.id, fresh.nodes)).toEqual([])

    const t = await topologyWithNodes('lost-alone', 1)
    const only = cred([t.id], 'lost-alone-cred')
    const [a] = t.nodes as [string]
    setDeviceAccess(t.id, [a], { credentialId: only.id })
    recordReadOutcomes(t.id, [{ entityId: a, status: 'failed' }], 1)
    expect(resolveTrialCandidates(t.id, [{ id: a, address: addr(0) }])).toEqual([])
  })

  test('when no other credential answers the device is left untouched', async () => {
    const { t, held, a, nodes } = await lostDevice('lost-none', 1)
    const candidates = resolveTrialCandidates(t.id, nodes)
    const found = await trialDevices(candidates, credentialsForTrial(t.id), async () => false)
    expect(found.matched).toEqual([])
    const retrying = new Set(candidates.filter((c) => c.skipCredentialId).map((c) => c.entityId))
    applyTrialResult(
      t.id,
      { matched: found.matched, silent: found.silent.filter((id) => !retrying.has(id)) },
      Date.now(),
    )
    const row = listDeviceAccess(t.id).get(a)
    expect(row).toMatchObject({ credentialId: held.id, lastStatus: 'failed', enabled: true })
    expect(row?.triedAt).toBeUndefined()
    expect(row?.assignedBy).toBeUndefined()
  })
})

describe('applyTrialResult', () => {
  test('writes the found credential as found-by-trial and stamps the silent ones', async () => {
    const t = await topologyWithNodes('apply', 3)
    const c = cred([t.id], 'apply-cred')
    const [a, b] = t.nodes as [string, string, string]
    applyTrialResult(t.id, { matched: [{ entityId: a, credentialId: c.id }], silent: [b] }, 5000)
    const rows = listDeviceAccess(t.id)
    expect(rows.get(a)).toMatchObject({ credentialId: c.id, assignedBy: 'probe', enabled: true })
    expect(rows.get(b)).toMatchObject({ triedAt: 5000 })
    expect(rows.get(b)?.credentialId).toBeUndefined()
  })

  test('a person choosing the credential replaces what a trial found', async () => {
    const t = await topologyWithNodes('apply-human', 1)
    const first = cred([t.id], 'apply-human-1')
    const second = cred([t.id], 'apply-human-2')
    const [a] = t.nodes as [string]
    applyTrialResult(t.id, { matched: [{ entityId: a, credentialId: first.id }], silent: [] }, 1)
    setDeviceAccess(t.id, [a], { credentialId: second.id })
    const row = listDeviceAccess(t.id).get(a)
    expect(row?.credentialId).toBe(second.id)
    expect(row?.assignedBy).toBeUndefined()
  })

  test('a credential the topology does not link is never written; foreign entities are ignored', async () => {
    const t = await topologyWithNodes('apply-foreign', 1)
    const elsewhere = cred([], 'apply-foreign-cred')
    const [a] = t.nodes as [string]
    applyTrialResult(
      t.id,
      {
        matched: [
          { entityId: 'nope', credentialId: elsewhere.id },
          { entityId: a, credentialId: elsewhere.id },
        ],
        silent: ['nope2'],
      },
      1,
    )
    expect(listDeviceAccess(t.id).size).toBe(0)
  })
})

describe('credentialsForTrial', () => {
  test('the credential most used in this topology is tried first', async () => {
    const t = await topologyWithNodes('order', 4)
    const rare = cred([t.id], 'order-a-rare')
    const common = cred([t.id], 'order-z-common')
    setDeviceAccess(t.id, t.nodes.slice(0, 3), { credentialId: common.id })
    setDeviceAccess(t.id, t.nodes.slice(3), { credentialId: rare.id })
    expect(credentialsForTrial(t.id).map((c) => c.community)).toEqual([
      'order-z-common',
      'order-a-rare',
    ])
  })

  test('ties break by name; only linked credentials are included', async () => {
    const t = await topologyWithNodes('order-tie', 1)
    cred([t.id], 'order-tie-b')
    cred([t.id], 'order-tie-a')
    cred([], 'order-tie-unlinked')
    expect(credentialsForTrial(t.id).map((c) => c.community)).toEqual([
      'order-tie-a',
      'order-tie-b',
    ])
  })
})

describe('deriveDeviceState', () => {
  const withAddress = { mgmtIp: '10.0.0.1' }
  const row = (over: Record<string, unknown>) =>
    ({ entityId: 'e', enabled: true, ...over }) as never

  test('turning reading off wins over everything', () => {
    expect(deriveDeviceState(withAddress, row({ enabled: false, credentialId: 'p' }), 0)).toBe(
      'disabled',
    )
  })

  test('no address means there is nothing to read', () => {
    expect(deriveDeviceState({}, undefined, 0)).toBe('no-address')
    expect(deriveDeviceState({}, row({ credentialId: 'p', lastStatus: 'ok' }), 0)).toBe(
      'no-address',
    )
  })

  test('with a credential: how the last read went', () => {
    const state = (over: Record<string, unknown>) =>
      deriveDeviceState(withAddress, row({ credentialId: 'p', ...over }), 0)
    expect(state({ lastStatus: 'ok' })).toBe('ok')
    expect(state({ lastStatus: 'failed' })).toBe('lost')
    expect(state({ lastStatus: 'partial' })).toBe('partial')
    expect(state({})).toBe('pending')
  })

  test('without a credential: unconfirmed until tried, silent until the clock moves', () => {
    expect(deriveDeviceState(withAddress, undefined, 0)).toBe('unconfirmed')
    expect(deriveDeviceState(withAddress, row({ triedAt: 100 }), 50)).toBe('silent')
    expect(deriveDeviceState(withAddress, row({ triedAt: 100 }), 100)).toBe('silent')
    expect(deriveDeviceState(withAddress, row({ triedAt: 100 }), 101)).toBe('unconfirmed')
  })
})

describe('read outcomes and trial memory coexist', () => {
  test('a stamped device keeps its stamp when an unrelated read outcome is recorded', async () => {
    const t = await topologyWithNodes('coexist', 2)
    const c = cred([t.id], 'coexist-cred')
    const [a, b] = t.nodes as [string, string]
    applyTrialResult(t.id, { matched: [{ entityId: a, credentialId: c.id }], silent: [b] }, 7)
    recordReadOutcomes(t.id, [{ entityId: a, status: 'ok' }], 9)
    const rows = listDeviceAccess(t.id)
    expect(rows.get(a)).toMatchObject({ lastStatus: 'ok', assignedBy: 'probe' })
    expect(rows.get(b)).toMatchObject({ triedAt: 7 })
  })
})
