// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A Rebuild re-fetches and draws again; it deletes nothing first, so a source whose fetch fails
 * keeps what it had.
 *
 * Run with: cd apps/server/api && bun test test/db/rebuild-keeps-data.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SourceNetwork } from '@shumoku/core'
import { createTopologySyncApplicationService } from '../../src/app/topology-sync.ts'
import { getDatabase } from '../../src/db/index.ts'
import type { DataSourceService } from '../../src/services/datasource.ts'
import { ObservationsService } from '../../src/services/observations.ts'
import { getSyncJob } from '../../src/services/sync-job.ts'
import type { TopologyService } from '../../src/services/topology.ts'
import { TopologySourcesService } from '../../src/services/topology-sources.ts'
import { attachSource, insertDataSource, setupTempDb } from './helper.ts'

const network: SourceNetwork = {
  network: { nodes: [{ id: 'sw', address: '10.0.0.1' }], links: [] },
}

describe('Rebuild', () => {
  let teardown: () => void
  let observations: ObservationsService

  beforeAll(() => {
    teardown = setupTempDb().teardown
    observations = new ObservationsService()
  })
  afterAll(() => teardown())

  function topologyWithSource(tag: string): { id: string; sourceId: string } {
    const id = `topo-${tag}`
    getDatabase()
      .query('INSERT INTO topologies (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
      .run(id, id)
    const sourceId = insertDataSource('netbox')
    attachSource(id, sourceId, 'topology')
    return { id, sourceId }
  }

  test('keeps a source whose fetch fails', async () => {
    const { id, sourceId } = topologyWithSource('fails')
    await observations.record({
      topologyId: id,
      sourceId,
      capturedAt: Date.now(),
      status: 'ok',
      source: network,
    })
    expect(observations.getContribution(id, sourceId)?.network.nodes).toHaveLength(1)

    // a NetBox that times out: the plugin loads, its fetch fails
    const sync = createTopologySyncApplicationService({
      topologies: { get: () => ({ id }) } as unknown as TopologyService,
      sources: new TopologySourcesService(),
      dataSources: {
        getPlugin: async () => ({
          type: 'netbox',
          capabilities: ['topology'],
          fetchTopology: async () => {
            throw new Error('request timed out after 30000ms')
          },
        }),
      } as unknown as DataSourceService,
      observations,
    })
    const job = await sync.start(id, true)
    expect(job).not.toBeNull()
    for (let i = 0; i < 50 && getSyncJob(id)?.state === 'running'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    expect(getSyncJob(id)?.state).toBe('failed')
    expect(observations.getContribution(id, sourceId)?.network.nodes).toHaveLength(1)
  })

  test('stores what is stored already again when forced, so the drawing is made again', async () => {
    const { id, sourceId } = topologyWithSource('forced')
    const record = (force: boolean) =>
      observations.record({
        topologyId: id,
        sourceId,
        capturedAt: Date.now(),
        status: 'ok',
        source: network,
        force,
      })
    expect((await record(false)).contributionChanged).toBe(true)
    expect((await record(false)).contributionChanged).toBe(false)
    expect((await record(true)).contributionChanged).toBe(true)
  })
})
