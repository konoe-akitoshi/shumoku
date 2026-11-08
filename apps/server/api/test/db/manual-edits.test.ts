// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A rename or a hide of a node is written into a Manual source (`PATCH .../sources/{id}/edits`):
 * a YAML node `{ id, label }` / `{ id, absent: true }` tied to the device by the registry key
 * `manual:<manualSourceId> = <id>`. The server never finds or creates the Manual source.
 *
 * Run with: cd apps/server/api && bun test test/db/manual-edits.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { ManualEditInput } from '../../src/app/services.ts'
import { DataSourceService } from '../../src/services/datasource.ts'
import { isDeriving } from '../../src/services/derivation.ts'
import { editManualNode } from '../../src/services/manual-edits.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { TopologyService } from '../../src/services/topology.ts'
import { TopologySourcesService } from '../../src/services/topology-sources.ts'
import {
  attachSource,
  getDatabase,
  insertDataSource,
  setupTempDb,
  type TempDb,
  timestamp,
} from './helper.ts'

let tmp: TempDb
let topologies: TopologyService
const sources = () => new TopologySourcesService()
let observations: ObservationsService

beforeAll(() => {
  tmp = setupTempDb()
  topologies = new TopologyService()
  observations = new ObservationsService()
})
// Edits kick background bakes; let them land before the shared database closes under them.
afterAll(async () => {
  for (const id of created) for (let i = 0; i < 200 && isDeriving(id); i++) await Bun.sleep(50)
  tmp.teardown()
})
const created: string[] = []

function topology(): string {
  const db = getDatabase()
  const id = `topo-${Math.random().toString(36).slice(2)}`
  const now = timestamp()
  db.query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    id,
    id,
    now,
    now,
  )
  created.push(id)
  return id
}

function setPriority(topologyId: string, dataSourceId: string, priority: number): void {
  getDatabase()
    .query(
      'UPDATE topology_data_sources SET priority = ? WHERE topology_id = ? AND data_source_id = ?',
    )
    .run(priority, topologyId, dataSourceId)
}

const edit = (topologyId: string, manualId: string, input: ManualEditInput) =>
  editManualNode(
    {
      db: getDatabase(),
      topologies,
      sources: sources(),
      dataSources: new DataSourceService(),
      observations,
    },
    topologyId,
    manualId,
    input,
  )

/** A scanning source that saw `dev` with a chassisId and no management address. */
async function scanned(
  topologyId: string,
  identity: { chassisId: string } = { chassisId: 'aa:bb:cc:00:00:01' },
) {
  const scan = insertDataSource('lldp')
  attachSource(topologyId, scan, 'topology')
  setPriority(topologyId, scan, 1)
  await observations.record({
    topologyId,
    sourceId: scan,
    capturedAt: Date.now(),
    status: 'ok',
    source: {
      network: { nodes: [{ id: 'dev', label: 'scan-name' }], links: [] },
      observation: { nodes: { dev: { identity } } },
    },
  })
  const entity = getDatabase()
    .query<{ entity_id: string }, [string, string]>(
      "SELECT entity_id FROM entity_identity_key WHERE topology_id = ? AND kind = 'node' AND key = 'chassisId' AND value = ?",
    )
    .get(topologyId, identity.chassisId)?.entity_id
  if (!entity) throw new Error('no entity minted')
  return { scan, entity }
}

function manualSource(topologyId: string, priority: number): string {
  const manual = insertDataSource('manual')
  attachSource(topologyId, manual, 'topology')
  setPriority(topologyId, manual, priority)
  return manual
}

const manualNodes = (topologyId: string, manual: string) =>
  observations.getContribution(topologyId, manual)?.network.nodes ?? []

async function resolvedNode(topologyId: string, entity: string) {
  // An edit kicks a background bake; wait for it to land before reading the graph.
  for (let i = 0; i < 200 && isDeriving(topologyId); i++) await Bun.sleep(50)
  const graph = (await topologies.getParsed(topologyId))?.graph
  return graph?.nodes.find((n) => n.id === entity)
}

const claimKeys = (topologyId: string, manual: string): string[] =>
  getDatabase()
    .query<{ value: string }, [string, string]>(
      "SELECT value FROM entity_identity_key WHERE topology_id = ? AND key = ? AND kind = 'node'",
    )
    .all(topologyId, `manual:${manual}`)
    .map((r) => r.value)

describe('PATCH /sources/{id}/edits writes into a Manual source', () => {
  test('no Manual source attached: 400, and none is created', async () => {
    const topologyId = topology()
    const { scan, entity } = await scanned(topologyId)
    const before = getDatabase().query('SELECT COUNT(*) AS c FROM data_sources').get()
    // A source that is not Manual is refused as well.
    expect((await edit(topologyId, scan, { nodeId: entity, label: 'X' })).ok).toBe(false)
    const res = await edit(topologyId, 'no-such-source', { nodeId: entity, label: 'X' })
    expect(res).toMatchObject({ ok: false, status: 400 })
    expect(getDatabase().query('SELECT COUNT(*) AS c FROM data_sources').get()).toEqual(
      before as never,
    )
  })

  test('unknown topology and unknown node: 404', async () => {
    const topologyId = topology()
    await scanned(topologyId)
    const manual = manualSource(topologyId, 5)
    expect(await edit('nope', manual, { nodeId: 'x', label: 'X' })).toMatchObject({ status: 404 })
    expect(await edit(topologyId, manual, { nodeId: 'nope', label: 'X' })).toMatchObject({
      ok: false,
      status: 404,
    })
  })

  test('a rename of a chassisId-only device shows in the YAML and the resolved label', async () => {
    const topologyId = topology()
    const { entity } = await scanned(topologyId)
    const manual = manualSource(topologyId, 5)

    const res = await edit(topologyId, manual, { nodeId: entity, label: 'Core Switch' })
    expect(res).toMatchObject({ ok: true, value: { label: 'Core Switch', yamlId: 'core-switch' } })

    // The YAML the editor shows: one plain node.
    expect(manualNodes(topologyId, manual)).toEqual([{ id: 'core-switch', label: 'Core Switch' }])
    expect(claimKeys(topologyId, manual)).toEqual(['core-switch'])
    // One device, not two, and it carries the new name.
    const node = await resolvedNode(topologyId, entity)
    expect(node?.label).toBe('Core Switch')
    const entities = getDatabase()
      .query("SELECT COUNT(*) AS c FROM entity_registry WHERE topology_id = ? AND kind = 'node'")
      .get(topologyId) as { c: number }
    expect(entities.c).toBe(1)

    // Renaming again reuses the YAML node instead of adding another.
    await edit(topologyId, manual, { nodeId: entity, label: 'Core 2' })
    expect(manualNodes(topologyId, manual)).toEqual([{ id: 'core-switch', label: 'Core 2' }])
    expect((await resolvedNode(topologyId, entity))?.label).toBe('Core 2')
  })

  test('a Manual source that is not the top priority: 409 and nothing is written', async () => {
    const topologyId = topology()
    const { scan, entity } = await scanned(topologyId)
    const manual = manualSource(topologyId, 5)
    expect((await edit(topologyId, manual, { nodeId: entity, label: 'A' })).ok).toBe(true)

    setPriority(topologyId, manual, 0) // below the scanning source's 1
    const res = await edit(topologyId, manual, { nodeId: entity, label: 'B' })
    expect(res).toMatchObject({
      ok: false,
      status: 409,
      extra: { reason: 'not-top-priority', top: scan },
    })
    expect(manualNodes(topologyId, manual)).toEqual([{ id: 'a', label: 'A' }])

    setPriority(topologyId, manual, 1) // a tie does not win either
    expect(await edit(topologyId, manual, { nodeId: entity, label: 'B' })).toMatchObject({
      status: 409,
    })
  })

  test('hide drops the node from the resolved graph; unhide brings it back', async () => {
    const topologyId = topology()
    const { entity } = await scanned(topologyId)
    const manual = manualSource(topologyId, 5)
    expect((await resolvedNode(topologyId, entity))?.label).toBe('scan-name')

    const hidden = await edit(topologyId, manual, { nodeId: entity, absent: true })
    expect(hidden).toMatchObject({ ok: true, value: { absent: true, yamlId: 'scan-name' } })
    expect(manualNodes(topologyId, manual)).toEqual([{ id: 'scan-name', absent: true }])
    expect(await resolvedNode(topologyId, entity)).toBeUndefined()

    await edit(topologyId, manual, { nodeId: entity, absent: false })
    expect(manualNodes(topologyId, manual)).toEqual([])
    expect((await resolvedNode(topologyId, entity))?.label).toBe('scan-name')
  })

  test('undo removes the YAML node and its claim key; an untouched node is a no-op', async () => {
    const topologyId = topology()
    const { entity } = await scanned(topologyId)
    const manual = manualSource(topologyId, 5)

    // Nothing was ever written: undoing it writes nothing.
    expect(await edit(topologyId, manual, { nodeId: entity, label: null })).toMatchObject({
      ok: true,
      value: { yamlId: null, label: null, absent: false },
    })
    expect(manualNodes(topologyId, manual)).toEqual([])

    await edit(topologyId, manual, { nodeId: entity, label: 'Renamed' })
    await edit(topologyId, manual, { nodeId: entity, absent: true })
    // Undoing the rename keeps the hide...
    await edit(topologyId, manual, { nodeId: entity, label: null })
    expect(manualNodes(topologyId, manual)).toEqual([{ id: 'renamed', absent: true }])
    // ...and undoing the hide as well leaves the node with nothing to say.
    await edit(topologyId, manual, { nodeId: entity, absent: false })
    expect(manualNodes(topologyId, manual)).toEqual([])
    expect(claimKeys(topologyId, manual)).toEqual([])
    expect((await resolvedNode(topologyId, entity))?.label).toBe('scan-name')
  })

  test('two devices with the same name get distinct YAML ids', async () => {
    const topologyId = topology()
    const a = await scanned(topologyId, { chassisId: 'aa:bb:cc:00:00:0a' })
    const b = await scanned(topologyId, { chassisId: 'aa:bb:cc:00:00:0b' })
    const manual = manualSource(topologyId, 5)
    await edit(topologyId, manual, { nodeId: a.entity, label: 'Switch' })
    await edit(topologyId, manual, { nodeId: b.entity, label: 'Switch' })
    expect(manualNodes(topologyId, manual).map((n) => n.id)).toEqual(['switch', 'switch-2'])
  })
})
