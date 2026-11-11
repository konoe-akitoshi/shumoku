// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/** Device access: the per-device row that points at a (linked) credential. */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createCredential } from '../../src/services/credentials.ts'
import {
  listDeviceAccess,
  recordReadOutcomes,
  resolveReadTargets,
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

/** A topology with node entities `a`, `b`, `c` (ids prefixed to stay unique). */
async function topologyWithNodes(name: string): Promise<{ id: string; nodes: string[] }> {
  const topo = await svc.create({ name })
  const now = timestamp()
  const nodes = ['a', 'b', 'c'].map((n) => `${name}:${n}`)
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

describe('device access', () => {
  test('bulk-assign a credential to many devices in one call', async () => {
    const t = await topologyWithNodes('assign-bulk')
    const c = cred([t.id], 'assign-bulk-cred')
    expect(setDeviceAccess(t.id, t.nodes, { credentialId: c.id })).toEqual({
      updated: 3,
      skipped: [],
    })
    const rows = listDeviceAccess(t.id)
    expect([...rows.values()].every((r) => r.credentialId === c.id && r.enabled)).toBe(true)
  })

  test('entities that are not nodes of the topology are skipped, not written', async () => {
    const a = await topologyWithNodes('assign-a')
    const b = await topologyWithNodes('assign-b')
    const c = cred([a.id], 'assign-skip-cred')
    const result = setDeviceAccess(a.id, [a.nodes[0] as string, b.nodes[0] as string, 'nope'], {
      credentialId: c.id,
    })
    expect(result).toEqual({ updated: 1, skipped: [b.nodes[0] as string, 'nope'] })
    expect(listDeviceAccess(b.id).size).toBe(0)
  })

  test('a credential the topology does not link cannot be assigned', async () => {
    const a = await topologyWithNodes('assign-cross-a')
    const b = await topologyWithNodes('assign-cross-b')
    const foreign = cred([b.id], 'assign-foreign')
    expect(setDeviceAccess(a.id, a.nodes, { credentialId: foreign.id })).toMatchObject({
      status: 404,
    })
    expect(setDeviceAccess(a.id, a.nodes, { credentialId: 'cr_missing' })).toMatchObject({
      status: 404,
    })
  })

  test('changing one field keeps the other', async () => {
    const t = await topologyWithNodes('assign-merge')
    const c = cred([t.id], 'assign-merge-cred')
    const id = t.nodes[0] as string
    setDeviceAccess(t.id, [id], { credentialId: c.id })
    setDeviceAccess(t.id, [id], { enabled: false })
    expect(listDeviceAccess(t.id).get(id)).toMatchObject({ credentialId: c.id, enabled: false })
  })

  test('nothing to update is a 400', async () => {
    const t = await topologyWithNodes('assign-empty-patch')
    expect(setDeviceAccess(t.id, t.nodes, {})).toMatchObject({ status: 400 })
  })

  test('an untouched default row is not kept', async () => {
    const t = await topologyWithNodes('assign-empty')
    const c = cred([t.id], 'assign-empty-cred')
    const id = t.nodes[0] as string
    setDeviceAccess(t.id, [id], { credentialId: c.id })
    setDeviceAccess(t.id, [id], { credentialId: null })
    expect(listDeviceAccess(t.id).has(id)).toBe(false)
  })

  test('read outcomes are recorded and survive un-assigning', async () => {
    const t = await topologyWithNodes('assign-outcome')
    const c = cred([t.id], 'assign-outcome-cred')
    const id = t.nodes[0] as string
    setDeviceAccess(t.id, [id], { credentialId: c.id })
    recordReadOutcomes(t.id, [{ entityId: id, status: 'failed', error: 'timeout' }], 1234)
    setDeviceAccess(t.id, [id], { credentialId: null })
    expect(listDeviceAccess(t.id).get(id)).toMatchObject({
      lastStatus: 'failed',
      lastError: 'timeout',
      lastReadAt: 1234,
    })
  })
})

describe('resolveReadTargets', () => {
  test('only enabled devices with a credential and an address are readable', async () => {
    const t = await topologyWithNodes('targets')
    const c = cred([t.id], 'targets-cred', 'c0mm')
    const [a, b, d] = t.nodes as [string, string, string]
    setDeviceAccess(t.id, [a, b, d], { credentialId: c.id })
    setDeviceAccess(t.id, [b], { enabled: false })

    const nodes = [
      { id: a, address: '10.0.0.1' },
      { id: b, address: '10.0.0.2' }, // disabled
      { id: d }, // no address
    ]
    expect(resolveReadTargets(t.id, nodes)).toEqual([
      { entityId: a, address: '10.0.0.1', community: 'c0mm' },
    ])
  })

  test('`only` narrows the read to the given devices', async () => {
    const t = await topologyWithNodes('targets-only')
    const c = cred([t.id], 'targets-only-cred')
    const [a, b] = t.nodes as [string, string, string]
    setDeviceAccess(t.id, t.nodes, { credentialId: c.id })
    const nodes = [
      { id: a, address: '10.0.1.1' },
      { id: b, address: '10.0.1.2' },
    ]
    expect(resolveReadTargets(t.id, nodes, new Set([b])).map((x) => x.entityId)).toEqual([b])
  })

  test('two nodes on one address are read once', async () => {
    const t = await topologyWithNodes('targets-dup')
    const c = cred([t.id], 'targets-dup-cred')
    const [a, b] = t.nodes as [string, string, string]
    setDeviceAccess(t.id, t.nodes, { credentialId: c.id })
    const nodes = [
      { id: a, address: '10.0.2.1' },
      { id: b, address: '10.0.2.1' },
    ]
    expect(resolveReadTargets(t.id, nodes)).toHaveLength(1)
  })
})
