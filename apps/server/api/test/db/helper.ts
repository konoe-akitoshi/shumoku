// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'bun:sqlite'
/**
 * Shared setup for DB-backed tests (run under `bun test`, not vitest — they need
 * `bun:sqlite`). Each test file inits a fresh temp database in `beforeAll` and
 * tears it down in `afterAll`; the DB connection is a process singleton, so
 * files run sequentially and each closes before the next inits.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EntityId, Identity, SourceNetwork } from '@shumoku/core'
import { asEntityId, sourceToGraph } from '@shumoku/core'
import {
  observedGraphToSource as graphToSource,
  type ObservedGraph as NetworkGraph,
  type ObservedNode,
  type ObservedPort,
} from '../../src/db/legacy/observed-graph.ts'
import { stampEntityIds } from '../../src/services/entity-registry.ts'
import {
  deviceAttributesOf,
  type ResolvedEntities,
  type ResolvedRecord,
} from '../../src/services/resolved-record.ts'
import type { ParsedTopology } from '../../src/services/topology.ts'

export type { NetworkGraph as ObservedGraph }
/**
 * Tests describe sources as the graph a source used to send (identity on nodes and ports); the
 * legacy reader turns one into what a source sends now, and `graphOf` joins a contribution's
 * record back onto its drawn graph so assertions read as before.
 */
export { graphToSource }

/** A contribution as a graph of the old shape: identity and the record joined onto each element. */
export function graphOf(source: SourceNetwork): NetworkGraph {
  const graph = sourceToGraph(source)
  const observation = source.observation
  return {
    ...graph,
    nodes: graph.nodes.map((n): ObservedNode => {
      const cfg = source.network.nodes.find((c) => c.id === n.id)
      const { ports: observedPorts, vendorIds, ...rest } = observation?.nodes?.[n.id] ?? {}
      const identity: Identity = {
        ...(cfg?.address && { mgmtIp: cfg.address }),
        ...(cfg?.chassisId && { chassisId: cfg.chassisId }),
        ...(cfg?.sysName && { sysName: cfg.sysName }),
        ...(cfg?.mac && { mac: cfg.mac }),
        ...(vendorIds && { vendorIds }),
      }
      const names = new Set([
        ...(n.ports ?? []).map((p) => p.id),
        ...Object.keys(observedPorts ?? {}),
      ])
      const ports = [...names].map((name): ObservedPort => {
        const drawn = n.ports?.find((p) => p.id === name) ?? {
          id: name,
          label: name,
          connectors: [],
        }
        const { ifIndex, ...observed } = observedPorts?.[name] ?? {}
        return {
          ...drawn,
          ...observed,
          identity: {
            ifName: name,
            ...(drawn.mac && { mac: drawn.mac }),
            ...(ifIndex !== undefined && { ifIndex }),
          },
        }
      })
      return {
        ...n,
        ...rest,
        ...(Object.keys(identity).length > 0 && { identity }),
        ...(ports.length > 0 && { ports }),
      }
    }),
    links: graph.links.map((l, i) => ({ ...l, ...observation?.links?.[l.id ?? `link-${i}`] })),
    ...(graph.subgraphs && {
      subgraphs: graph.subgraphs.map((sg) => ({ ...sg, ...observation?.groups?.[sg.id] })),
    }),
    ...(observation?.attachments && { attachments: [...observation.attachments] }),
    ...(observation?.exclusions && { exclusions: [...observation.exclusions] }),
  }
}

import {
  closeDatabase,
  generateId,
  getDatabase,
  initDatabase,
  timestamp,
} from '../../src/db/index.ts'
import {
  buildNetwork,
  type IngestOptions,
  ingestNetwork,
} from '../../src/services/contribution-store.ts'

export interface TempDb {
  dir: string
  teardown: () => void
}

export function setupTempDb(): TempDb {
  const dir = mkdtempSync(join(tmpdir(), 'shumoku-db-test-'))
  initDatabase(dir)
  return {
    dir,
    teardown: () => {
      closeDatabase()
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Windows may hold the file briefly; the temp dir is reaped by the OS.
      }
    },
  }
}

export { generateId, getDatabase, timestamp }

/** Insert a data source row directly (bypassing the plugin layer). */
export function insertDataSource(type: string, id?: string): string {
  const db = getDatabase()
  const sid = id ?? `ds_${Math.abs(hash(type + Math.random().toString()))}`
  const now = timestamp()
  db.query(
    `INSERT INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
     VALUES (?, ?, ?, '{}', 'connected', 0, ?, ?)`,
  ).run(sid, type, type, now, now)
  return sid
}

/** Attach a data source to a topology via the m2m table. */
export function attachSource(
  topologyId: string,
  dataSourceId: string,
  purpose: 'topology' | 'metrics',
): void {
  const db = getDatabase()
  const now = timestamp()
  db.query(
    `INSERT INTO topology_data_sources (id, topology_id, data_source_id, purpose, sync_mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'manual', ?, ?)`,
  ).run(`tds_${topologyId}_${dataSourceId}_${purpose}`, topologyId, dataSourceId, purpose, now, now)
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

/**
 * Tests describe sources as the graph a source used to send; these turn one into what a source
 * sends now (`SourceNetwork`) and project a stored contribution back to a graph to assert on.
 */
export function ingestGraphFixture(
  topologyId: string,
  sourceId: string,
  graph: NetworkGraph,
  opts?: IngestOptions,
): void {
  ingestNetwork(topologyId, sourceId, graphToSource(graph), opts)
}

/** A served graph with its record joined back on, in the old shape: identity, provenance, entityId. */
export function parsedGraph(parsed: ParsedTopology | null | undefined): NetworkGraph {
  if (!parsed) return { version: '1', nodes: [], links: [] }
  return withEntities(
    {
      ...parsed.graph,
      nodes: parsed.graph.nodes.map((n) => {
        const a = parsed.record.attributes[n.id]
        const observed = parsed.record.observation.nodes?.[n.id]
        const identity: Identity = {
          ...(a?.address && { mgmtIp: a.address }),
          ...(a?.chassisId && { chassisId: a.chassisId }),
          ...(a?.sysName && { sysName: a.sysName }),
          ...(a?.mac && { mac: a.mac }),
          ...(observed?.vendorIds && { vendorIds: observed.vendorIds }),
        }
        return {
          ...n,
          ...(Object.keys(identity).length > 0 && { identity }),
          ...(observed?.provenance && { provenance: observed.provenance }),
          ...(observed?.metadata && { metadata: observed.metadata }),
        }
      }),
      links: parsed.graph.links.map((l, i) => ({
        ...l,
        ...parsed.record.observation.links?.[l.id ?? `link-${i}`],
      })),
    },
    parsed.record.entities,
  )
}

/** Writes entity ids onto a graph's nodes, ports and links, as the old shape carried them. */
function withEntities(graph: NetworkGraph, entities: ResolvedEntities): NetworkGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const entityId = entities.nodes[n.id]
      const ports = n.ports?.map((p) => {
        const portEntity = entities.ports[`${n.id}:${p.id}`]
        return portEntity ? { ...p, entityId: portEntity } : p
      })
      return { ...n, ...(entityId && { entityId }), ...(ports && { ports }) }
    }),
    links: graph.links.map((l, i) => {
      const entityId = entities.links[l.id || `link-${i}`]
      return entityId ? { ...l, entityId } : l
    }),
  }
}

/** The entity ids a graph of the old shape carries on its elements, as the registry returns them. */
export function entitiesOf(graph: NetworkGraph): ResolvedEntities {
  const entities: ResolvedEntities = { nodes: {}, ports: {}, links: {} }
  for (const n of graph.nodes) {
    if (n.entityId) entities.nodes[n.id] = n.entityId
    for (const p of n.ports ?? []) if (p.entityId) entities.ports[`${n.id}:${p.id}`] = p.entityId
  }
  for (const [i, l] of graph.links.entries()) {
    if (l.entityId) entities.links[l.id || `link-${i}`] = l.entityId
  }
  return entities
}

/** Looks a graph of the old shape up in the registry and returns it with entity ids stamped. */
export function stampGraph(topologyId: string, graph: NetworkGraph, db: Database): NetworkGraph {
  const source = graphToSource(graph)
  const record: Pick<ResolvedRecord, 'observation' | 'attributes'> = {
    observation: source.observation ?? {},
    attributes: deviceAttributesOf({ config: source.network }),
  }
  const entities = stampEntityIds(topologyId, sourceToGraph(source), record, db)
  return withEntities(graphOf(source), entities)
}

export const entityId = (id: string): EntityId => asEntityId(id)

export function buildGraphView(topologyId: string, sourceId: string): NetworkGraph | null {
  const built = buildNetwork(topologyId, sourceId)
  return built ? graphOf(built) : null
}
