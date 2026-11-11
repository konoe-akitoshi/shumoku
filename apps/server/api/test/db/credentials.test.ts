// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Credentials: server-wide, write-only secrets, linked to the topologies that
 * use them. The retry clock, the effect of an edit, identical-content linking,
 * deletion and the sample a credential test probes.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createCredentialApplicationService } from '../../src/app/credentials.ts'
import type { Probe } from '../../src/discovery/credential-trial.ts'
import { getAccessMethod, normalizeParams } from '../../src/services/access-methods.ts'
import {
  createCredential,
  deleteCredential,
  getCredentialAdmin,
  listCredentialsAdmin,
  listCredentialsForTopology,
  pickTestSample,
  selectTestSample,
  silentCount,
  topologyClock,
  updateCredential,
} from '../../src/services/credentials.ts'
import {
  applyTrialResult,
  listDeviceAccess,
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

async function topologyWithNodes(name: string, count = 3) {
  const topo = await svc.create({ name })
  const now = timestamp()
  const nodes = Array.from({ length: count }, (_, i) => `${name}:n${i}`)
  const insert = getDatabase().query(
    `INSERT INTO entity_registry (id, topology_id, kind, status, first_seen_at, last_seen_at)
     VALUES (?, ?, 'node', 'active', ?, ?)`,
  )
  for (const id of nodes) insert.run(id, topo.id, now, now)
  return { id: topo.id, name, nodes }
}

/** A credential whose community is its name unless given — keeps contents unique per test. */
function cred(topologyIds: string[], name: string, community = name) {
  const result = createCredential({ name, method: 'snmp', params: { community }, topologyIds })
  if ('error' in result) throw new Error(result.error)
  return result.credential
}

function setSecretChangedAt(credentialId: string, at: number) {
  getDatabase()
    .query('UPDATE credential SET secret_changed_at = ? WHERE id = ?')
    .run(at, credentialId)
}
function setAdded(topologyId: string, credentialId: string, at: number) {
  getDatabase()
    .query(
      'UPDATE topology_credential SET added_at = ? WHERE topology_id = ? AND credential_id = ?',
    )
    .run(at, topologyId, credentialId)
}

describe('credential basics', () => {
  test('a secret is reported as set and never appears in any view', async () => {
    const t = await topologyWithNodes('sec-views')
    const c = cred([t.id], 'sec-lab', 's3cret-VALUE')
    setDeviceAccess(t.id, t.nodes, { credentialId: c.id })
    expect(c.secretsSet).toEqual(['community'])
    expect(c.params).toEqual({})
    for (const view of [
      c,
      getCredentialAdmin(c.id),
      listCredentialsAdmin(),
      listCredentialsForTopology(t.id),
      listDeviceAccess(t.id).get(t.nodes[0] as string),
    ]) {
      expect(JSON.stringify(view)).not.toContain('s3cret-VALUE')
    }
  })

  test('error messages never echo a secret', async () => {
    const t = await topologyWithNodes('sec-errors')
    const method = getAccessMethod('snmp')
    if (!method) throw new Error('snmp missing')
    expect(JSON.stringify(normalizeParams(method, { community: 12345 }))).not.toContain('12345')
    const taken = cred([t.id], 'sec-dup', 'echo-me-not')
    const dup = createCredential({
      name: taken.name,
      method: 'snmp',
      params: { community: 'echo-me-not-2' },
    })
    expect(JSON.stringify(dup)).not.toContain('echo-me-not-2')
    expect(createCredential({ method: 'snmp', params: {} })).toMatchObject({ status: 400 })
  })

  test('required fields, unknown methods and unknown topologies are rejected', () => {
    expect(createCredential({ method: 'snmp', params: {}, topologyIds: [] })).toMatchObject({
      status: 400,
    })
    expect(createCredential({ method: 'carrier-pigeon', params: {} })).toMatchObject({
      status: 400,
    })
    expect(
      createCredential({ method: 'snmp', params: { community: 'x-unk' }, topologyIds: ['nope'] }),
    ).toMatchObject({ status: 404 })
  })

  test('a blank name is numbered automatically, smallest unused first', () => {
    const a = createCredential({ method: 'snmp', params: { community: 'auto-a' }, topologyIds: [] })
    const b = createCredential({ name: '  ', method: 'snmp', params: { community: 'auto-b' } })
    if ('error' in a || 'error' in b) throw new Error('create failed')
    expect(a.credential.name).toMatch(/^SNMP \d+$/)
    expect(b.credential.name).toMatch(/^SNMP \d+$/)
    expect(a.credential.name).not.toBe(b.credential.name)
    const n = Number(a.credential.name.split(' ')[1])
    deleteCredential(a.credential.id)
    const c = createCredential({ method: 'snmp', params: { community: 'auto-c' } })
    if ('error' in c) throw new Error('create failed')
    expect(Number(c.credential.name.split(' ')[1])).toBe(n)
  })

  test('a name is unique server-wide', () => {
    cred([], 'dup-name', 'dup-name-1')
    expect(
      createCredential({ name: 'dup-name', method: 'snmp', params: { community: 'dup-name-2' } }),
    ).toMatchObject({ status: 409 })
  })

  test('identical content links the existing credential instead of duplicating', async () => {
    const a = await topologyWithNodes('ident-a')
    const b = await topologyWithNodes('ident-b')
    const first = cred([a.id], 'ident-one', 'ident-comm')
    const before = listCredentialsAdmin().length
    const again = createCredential({
      name: 'another-name',
      method: 'snmp',
      params: { community: 'ident-comm' },
      topologyIds: [b.id],
    })
    if ('error' in again) throw new Error(again.error)
    expect(again.linkedExisting).toBe(true)
    expect(again.credential.id).toBe(first.id)
    expect(listCredentialsAdmin().length).toBe(before)
    expect(again.credential.topologies.map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
  })

  test('a secret left empty on edit keeps it; a new one replaces it', async () => {
    const t = await topologyWithNodes('edit-secret', 1)
    const c = cred([t.id], 'edit-secret', 'old')
    const node = t.nodes[0] as string
    setDeviceAccess(t.id, [node], { credentialId: c.id })
    updateCredential(c.id, { name: 'edit-secret-renamed', params: { community: '' } })
    const nodes = [{ id: node, address: '10.0.0.1' }]
    expect(resolveReadTargets(t.id, nodes)[0]?.community).toBe('old')
    updateCredential(c.id, { params: { community: 'new' } })
    expect(resolveReadTargets(t.id, nodes)[0]?.community).toBe('new')
    expect(getCredentialAdmin(c.id)?.name).toBe('edit-secret-renamed')
  })
})

describe('the retry clock', () => {
  test('a rename does not move it, a secret change does, adding a link does, removing does not', async () => {
    const a = await topologyWithNodes('clock-a', 1)
    const b = await topologyWithNodes('clock-b', 1)
    const c = cred([a.id], 'clock-cred', 'clock-1')
    // Pin the stamps in the past so every move is visible.
    setSecretChangedAt(c.id, 1000)
    setAdded(a.id, c.id, 1000)
    expect(topologyClock(a.id)).toBe(1000)
    expect(topologyClock(b.id)).toBe(0)

    updateCredential(c.id, { name: 'clock-renamed' })
    expect(topologyClock(a.id)).toBe(1000)

    updateCredential(c.id, { params: { community: 'clock-2' } })
    expect(topologyClock(a.id)).toBeGreaterThan(1000)

    setSecretChangedAt(c.id, 1000)
    updateCredential(c.id, { topologyIds: [a.id, b.id] })
    expect(topologyClock(b.id)).toBeGreaterThan(1000)
    expect(topologyClock(a.id)).toBe(1000) // a's link was not added now

    updateCredential(c.id, { topologyIds: [a.id] })
    expect(topologyClock(b.id)).toBe(0)
    expect(topologyClock(a.id)).toBe(1000)
  })

  test('silent versus unconfirmed follows the clock per topology', async () => {
    const t = await topologyWithNodes('clock-silent', 2)
    const c = cred([t.id], 'clock-silent-cred')
    setSecretChangedAt(c.id, 1000)
    setAdded(t.id, c.id, 1000)
    applyTrialResult(t.id, { matched: [], silent: t.nodes }, 5000)
    expect(silentCount(t.id)).toBe(2)
    updateCredential(c.id, { params: { community: 'clock-silent-new' } })
    expect(silentCount(t.id)).toBe(0)
  })
})

describe('both cases: one network in many diagrams, and separate networks', () => {
  test('a credential not linked to a topology cannot be assigned there and is never read with', async () => {
    const site1 = await topologyWithNodes('caseb-1', 1)
    const site2 = await topologyWithNodes('caseb-2', 1)
    const c = cred([site1.id], 'caseb-cred')
    expect(setDeviceAccess(site2.id, site2.nodes, { credentialId: c.id })).toMatchObject({
      status: 404,
    })
    expect(listCredentialsForTopology(site2.id)).toEqual([])
    expect(listCredentialsForTopology(site1.id).map((x) => x.id)).toEqual([c.id])
    // Even a stray row cannot make it readable there.
    getDatabase()
      .query(
        `INSERT INTO device_access (entity_id, topology_id, credential_id, enabled, updated_at)
         VALUES (?, ?, ?, 1, ?)`,
      )
      .run(site2.nodes[0] as string, site2.id, c.id, 1)
    const nodes = [{ id: site2.nodes[0] as string, address: '10.1.1.1' }]
    expect(resolveReadTargets(site2.id, nodes)).toEqual([])
  })

  test('one credential linked to two topologies is rotated once; effect reports both', async () => {
    const a = await topologyWithNodes('rot-a', 2)
    const b = await topologyWithNodes('rot-b', 1)
    const c = cred([a.id, b.id], 'rot-cred', 'rot-1')
    setDeviceAccess(a.id, a.nodes, { credentialId: c.id })
    setDeviceAccess(b.id, b.nodes, { credentialId: c.id })
    const result = updateCredential(c.id, { params: { community: 'rot-2' } })
    if ('error' in result) throw new Error(result.error)
    expect(result.effect.map((e) => [e.topologyId, e.devices]).sort()).toEqual(
      [
        [a.id, 2],
        [b.id, 1],
      ].sort(),
    )
    const nodes = [{ id: b.nodes[0] as string, address: '10.2.2.2' }]
    expect(resolveReadTargets(b.id, nodes)[0]?.community).toBe('rot-2')
  })

  test('effect counts silent devices that become retry-eligible', async () => {
    const t = await topologyWithNodes('eff-silent', 3)
    const c = cred([t.id], 'eff-cred', 'eff-1')
    setDeviceAccess(t.id, [t.nodes[0] as string], { credentialId: c.id })
    setSecretChangedAt(c.id, 1000)
    setAdded(t.id, c.id, 1000)
    applyTrialResult(t.id, { matched: [], silent: t.nodes.slice(1) }, 5000)
    const result = updateCredential(c.id, { params: { community: 'eff-2' } })
    if ('error' in result) throw new Error(result.error)
    expect(result.effect).toEqual([{ topologyId: t.id, name: t.name, devices: 1, retrySilent: 2 }])
  })

  test('removing a topology un-assigns the credential there; rename alone has no effect', async () => {
    const a = await topologyWithNodes('unlink-a', 2)
    const b = await topologyWithNodes('unlink-b', 1)
    const c = cred([a.id, b.id], 'unlink-cred')
    setDeviceAccess(a.id, a.nodes, { credentialId: c.id })
    setDeviceAccess(b.id, b.nodes, { credentialId: c.id })
    const rename = updateCredential(c.id, { name: 'unlink-renamed' })
    if ('error' in rename) throw new Error(rename.error)
    expect(rename.effect).toEqual([])

    const result = updateCredential(c.id, { topologyIds: [b.id] })
    if ('error' in result) throw new Error(result.error)
    expect(result.effect).toEqual([{ topologyId: a.id, name: a.name, devices: 2, retrySilent: 0 }])
    for (const row of listDeviceAccess(a.id).values()) expect(row.credentialId).toBeUndefined()
    expect([...listDeviceAccess(b.id).values()].every((r) => r.credentialId === c.id)).toBe(true)
  })

  test('delete un-assigns every device and drops the links', async () => {
    const a = await topologyWithNodes('del-a', 2)
    const b = await topologyWithNodes('del-b', 1)
    const c = cred([a.id, b.id], 'del-cred')
    setDeviceAccess(a.id, a.nodes, { credentialId: c.id })
    setDeviceAccess(b.id, b.nodes, { credentialId: c.id })
    expect(deleteCredential(c.id)).toEqual({ unassigned: 3, topologies: 2 })
    expect(deleteCredential(c.id)).toBeNull()
    expect(listCredentialsForTopology(a.id)).toEqual([])
    for (const row of listDeviceAccess(a.id).values()) expect(row.credentialId).toBeUndefined()
  })
})

describe('credential views', () => {
  test('usage counts by last read outcome, per topology', async () => {
    const t = await topologyWithNodes('usage', 4)
    const c = cred([t.id], 'usage-cred')
    setDeviceAccess(t.id, t.nodes, { credentialId: c.id })
    const set = getDatabase().query(
      'UPDATE device_access SET last_status = ?, last_read_at = ? WHERE entity_id = ?',
    )
    set.run('ok', 10, t.nodes[0] as string)
    set.run('ok', 30, t.nodes[1] as string)
    set.run('failed', 20, t.nodes[2] as string)
    const view = listCredentialsForTopology(t.id)[0]
    expect(view?.usage).toEqual({ ok: 2, partial: 0, failed: 1, pending: 1 })
    expect(view?.lastOkAt).toBe(30)
    expect(getCredentialAdmin(c.id)?.topologies[0]?.usage).toEqual({
      ok: 2,
      partial: 0,
      failed: 1,
      pending: 1,
    })
  })
})

describe('credential test', () => {
  const sample = (
    n: number,
    over: Partial<{ uses: boolean; none: boolean }> = {},
    prefix = '10.0.0',
  ) =>
    Array.from({ length: n }, (_, i) => ({
      entityId: `${prefix}.${i + 1}`,
      address: `${prefix}.${i + 1}`,
      usesCredential: over.uses ?? false,
      hasNone: over.none ?? true,
    }))

  test('at most 10, users of the credential first, then devices with none', () => {
    const picked = selectTestSample([
      ...sample(4, { uses: true, none: false }, '10.1.0'),
      ...sample(20, {}, '10.2.0'),
      // a device on a different credential is never probed
      { entityId: 'other', address: '10.3.0.1', usesCredential: false, hasNone: false },
    ])
    expect(picked).toHaveLength(10)
    expect(picked.slice(0, 4).every((p) => p.usesCredential)).toBe(true)
    expect(picked.slice(4).every((p) => p.hasNone && !p.usesCredential)).toBe(true)
    expect(picked.find((p) => p.entityId === 'other')).toBeUndefined()
  })

  test('round-robin across /24 prefixes, deterministic', () => {
    const cands = [
      ...sample(5, {}, '10.0.1'),
      ...sample(5, {}, '10.0.2'),
      ...sample(5, {}, '10.0.3'),
    ]
    const picked = selectTestSample([...cands].reverse(), 6)
    expect(picked.map((p) => p.address)).toEqual([
      '10.0.1.1',
      '10.0.2.1',
      '10.0.3.1',
      '10.0.1.2',
      '10.0.2.2',
      '10.0.3.2',
    ])
    expect(selectTestSample(cands, 6)).toEqual(picked)
  })

  test('pickTestSample honours explicit devices (capped) and skips disabled or addressless ones', () => {
    const nodes = Array.from({ length: 14 }, (_, i) => ({
      id: `e${i}`,
      ...(i === 3 ? {} : { address: `10.0.0.${i + 1}` }),
    }))
    const access = new Map([['e0', { enabled: false }]])
    const explicit = pickTestSample({ nodes, access, entityIds: nodes.map((n) => n.id) })
    expect(explicit).toHaveLength(10)
    expect(explicit.map((e) => e.entityId)).not.toContain('e0')
    expect(explicit.map((e) => e.entityId)).not.toContain('e3')
  })

  test('the test sends only the sample, reports answers, and stores nothing', async () => {
    const t = await topologyWithNodes('ct-run', 12)
    const c = cred([t.id], 'ct-cred', 'ct-stored')
    const nodes = t.nodes.map((id) => ({ id }))
    const attributes = Object.fromEntries(
      t.nodes.map((id, i) => [id, { address: `10.7.0.${i + 1}` }]),
    )
    const fakeTopologies = {
      getParsed: async () => ({ graph: { nodes }, record: { attributes } }),
    } as unknown as TopologyService
    const seen: string[] = []
    const probe: Probe = async (address, community) => {
      seen.push(`${address}|${community}`)
      return address.endsWith('.1') || address.endsWith('.2')
    }
    const service = createCredentialApplicationService({ topologies: fakeTopologies, probe })
    const rowsBefore = getDatabase().query('SELECT COUNT(*) AS n FROM device_access').get()
    const adminBefore = JSON.stringify(listCredentialsAdmin())

    // The stored secret is used when none is supplied.
    const stored = await service.test({ topologyId: t.id, method: 'snmp', credentialId: c.id })
    expect(stored).toEqual({ ok: true, value: { sent: 10, answered: 2, silent: 8 } })
    expect(seen.every((s) => s.endsWith('|ct-stored'))).toBe(true)

    // A supplied secret wins.
    seen.length = 0
    await service.test({
      topologyId: t.id,
      method: 'snmp',
      params: { community: 'typed' },
      credentialId: c.id,
    })
    expect(seen.every((s) => s.endsWith('|typed'))).toBe(true)

    expect(getDatabase().query('SELECT COUNT(*) AS n FROM device_access').get()).toEqual(rowsBefore)
    expect(JSON.stringify(listCredentialsAdmin())).toBe(adminBefore)
  })

  test('no secret anywhere is a 400; no eligible device is sent=0; unknown topology is 404', async () => {
    const t = await topologyWithNodes('ct-edge', 1)
    const noAddress = {
      getParsed: async () => ({
        graph: { nodes: [{ id: t.nodes[0] }] },
        record: { attributes: {} },
      }),
    } as unknown as TopologyService
    const service = createCredentialApplicationService({
      topologies: noAddress,
      probe: async () => true,
    })
    expect(await service.test({ topologyId: t.id, method: 'snmp' })).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(
      await service.test({ topologyId: t.id, method: 'snmp', params: { community: 'zero-dev' } }),
    ).toEqual({ ok: true, value: { sent: 0, answered: 0, silent: 0 } })
    expect(
      await service.test({ topologyId: 'nope', method: 'snmp', params: { community: 'x' } }),
    ).toMatchObject({ ok: false, status: 404 })
  })
})
