// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Removing the project overlay.
 *
 * Until 0.3.0-beta.2 every topology could hold a hidden "project overlay": a
 * `contribution_source` row with `source_id = 'intrinsic'` and no attachment, folded on top of
 * every attached source. Nothing in the GUI showed it, so what it held could be neither seen nor
 * edited as a source. It is gone: the human is a source like any other.
 *
 * Where each part of it went:
 *  - the display setting (`hideDisconnected`) is a column on the topology;
 *  - a rename (a node `label`) and a hide (an `observation.exclusions` entry) become nodes of a
 *    Manual source named "<topology> edits", written the way a person writes them in YAML:
 *    `{ id, label }` or `{ id, absent: true }`. The node is tied to the device it was about by
 *    the entity registry, not by a field of the YAML;
 *  - a hand-drawn network (links between the overlay's own nodes, the demo sample) moves as it
 *    is into the same Manual source;
 *  - everything else is dropped, and logged by id: anchor nodes and ports left by metrics
 *    bindings, `edgeStyle`, `suppressedAttachments`, topology-default attachments.
 *
 * Reading an overlay stays here, for this step and for the metrics-mapping backfill that must
 * run first: a database from 0.2.x still keeps its metrics bindings in the overlay.
 */

import type { Database } from 'bun:sqlite'
import type {
  Attachment,
  EntityId,
  Identity,
  inputModel,
  NodeExclusion,
  SourceNetwork,
} from '@shumoku/core'
import { generateId, timestamp } from '../db/index.js'
import { buildNetwork } from './contribution-store.js'
import { claimNodeForSource, findNodeEntities, findNodeEntityById } from './entity-registry.js'
import { ObservationsService } from './observations.js'
import type { TopologySourcesService } from './topology-sources.js'

/** The `source_id` the overlay was stored under. */
export const LEGACY_OVERLAY_SOURCE_ID = 'intrinsic'

const hasMetricsBinding = (atts: readonly Attachment[] | undefined): boolean =>
  (atts ?? []).some((a) => a.kind === 'metrics-binding')

/** Whether the overlay still carries a metrics-binding attachment on a node or a port. */
export function overlayHasMetricsBinding(overlay: SourceNetwork | null): boolean {
  return Object.values(overlay?.observation?.nodes ?? {}).some(
    (o) =>
      hasMetricsBinding(o.attachments) ||
      Object.values(o.ports ?? {}).some((p) => hasMetricsBinding(p.attachments)),
  )
}

/** A SourceNetwork without its `network`, i.e. the observation / design / drawing layers. */
export function withoutNetwork(source: SourceNetwork): Omit<SourceNetwork, 'network'> {
  const { network: _network, ...layers } = source
  return layers
}

/** Create a Manual data source and attach it to the topology for the `topology` purpose. */
export async function createManualSource(
  db: Database,
  sources: TopologySourcesService,
  topologyId: string,
  opts: { name: string; purpose?: 'topology' | 'metrics'; priority?: number },
): Promise<{ dataSourceId: string }> {
  const now = timestamp()
  const dataSourceId = await generateId()
  db.prepare(
    `INSERT INTO data_sources (id, name, type, config_json, status, fail_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(dataSourceId, opts.name, 'manual', '{}', 'connected', 0, now, now)
  await sources.add(topologyId, {
    dataSourceId,
    purpose: opts.purpose ?? 'topology',
    syncMode: 'manual',
    ...(opts.priority !== undefined && { priority: opts.priority }),
  })
  return { dataSourceId }
}

/** One above every topology-purpose source already attached, so the new source wins. */
export function nextTopPriority(db: Database, topologyId: string): number {
  const row = db
    .query(
      "SELECT MAX(priority) AS top FROM topology_data_sources WHERE topology_id = ? AND purpose = 'topology'",
    )
    .get(topologyId) as { top: number | null } | undefined
  return (row?.top ?? -1) + 1
}

// --- what to carry -----------------------------------------------------------

type Node = inputModel.Node

/** A node that says nothing but "this is here": no label, no fields beyond the id. */
function isAnchorNode(node: Node, referenced: ReadonlySet<string>): boolean {
  if (referenced.has(node.id)) return false
  if ((node.label ?? '').trim() !== '') return false
  return Object.entries(node).every(([k, v]) => k === 'id' || k === 'label' || v === undefined)
}

interface CarriedEdit {
  entityId: EntityId
  label?: string
  absent?: true
}

/** The id written in the Manual YAML, which the registry key is claimed under as well. */
type PlannedEdit = CarriedEdit & { yamlId: string }

const slug = (name: string | undefined): string =>
  (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** `base`, or `base-2`, `base-3`, ... until unused; the entity id when there is no name. */
function uniqueId(base: string, fallback: string, taken: ReadonlySet<string>): string {
  if (base === '') return fallback
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/** The best name an entity is known by: a source's label for it, else its sysName. */
function nameOfEntity(db: Database, topologyId: string, entityId: EntityId): string | undefined {
  const rows = db
    .query(
      `SELECT ce.payload_json AS payload
       FROM entity_element ee
       JOIN contribution_element ce ON ce.topology_id = ee.topology_id
         AND ce.source_id = ee.source_id AND ce.local_id = ee.local_id AND ce.kind = 'node'
       WHERE ee.topology_id = ? AND ee.entity_id = ? AND ee.kind = 'node' AND ee.source_id != ?`,
    )
    .all(topologyId, entityId, LEGACY_OVERLAY_SOURCE_ID) as { payload: string | null }[]
  for (const { payload } of rows) {
    try {
      const label = (JSON.parse(payload ?? '{}') as { config?: { label?: unknown } }).config?.label
      if (typeof label === 'string' && label.trim() !== '') return label
    } catch {
      // an unreadable payload names nothing
    }
  }
  const sys = db
    .query(
      `SELECT value FROM entity_identity_key
       WHERE topology_id = ? AND entity_id = ? AND kind = 'node' AND key = 'sysName' LIMIT 1`,
    )
    .get(topologyId, entityId) as { value: string } | undefined
  return sys?.value
}

interface Plan {
  /** The Manual source's network, or null when there is nothing to carry. */
  network: inputModel.Network | null
  /** Renames and hides, by the entity they are about. */
  edits: PlannedEdit[]
  renamed: number
  hidden: number
  handDrawnNodes: number
  handDrawnLinks: number
  /** Ids (never names or addresses) of claims that could not be tied to a device. */
  unresolved: string[]
  droppedNodes: number
  droppedPorts: number
}

/** The device an identity (or, failing that, a node id used as an entity id) refers to. */
function entityOf(
  db: Database,
  topologyId: string,
  identity: Identity | undefined,
  nodeId: string | undefined,
): EntityId | 'ambiguous' | null {
  if (identity) {
    const found = findNodeEntities(topologyId, identity, db)
    if (found.length === 1 && found[0]) return found[0]
    if (found.length > 1) return 'ambiguous'
  }
  return nodeId ? findNodeEntityById(topologyId, nodeId, db) : null
}

export function planCarry(db: Database, topologyId: string, overlay: SourceNetwork): Plan {
  const { network, observation } = overlay
  const referenced = new Set(
    network.links.flatMap((l) => l.endpoints.flatMap((e) => ('node' in e ? [e.node] : []))),
  )
  const handDrawn = network.links.length > 0
  const own = handDrawn ? network.nodes.filter((n) => !isAnchorNode(n, referenced)) : []
  const ownIds = new Set(own.map((n) => n.id))

  const byEntity = new Map<EntityId, CarriedEdit>()
  const unresolved: string[] = []
  let renamed = 0
  let hidden = 0

  for (const node of network.nodes) {
    if (ownIds.has(node.id)) continue
    const label = (node.label ?? '').trim()
    if (label === '') continue
    const hit = entityOf(db, topologyId, observation?.nodes?.[node.id]?.identity, node.id)
    if (hit === null || hit === 'ambiguous') {
      unresolved.push(node.id)
      continue
    }
    byEntity.set(hit, { ...byEntity.get(hit), entityId: hit, label })
    renamed++
  }

  for (const [i, ex] of (observation?.exclusions ?? []).entries()) {
    const identity = exclusionIdentity(ex)
    const found = identity ? findNodeEntities(topologyId, identity, db) : []
    if (found.length === 0) {
      unresolved.push(`exclusion[${i}]`)
      continue
    }
    for (const entityId of found) {
      byEntity.set(entityId, { ...byEntity.get(entityId), entityId, absent: true })
      hidden++
    }
  }

  const taken = new Set(ownIds)
  const edits: PlannedEdit[] = [...byEntity.values()].map((e) => {
    const yamlId = uniqueId(
      slug(e.label ?? nameOfEntity(db, topologyId, e.entityId)),
      e.entityId,
      taken,
    )
    taken.add(yamlId)
    return { ...e, yamlId }
  })
  const nodes: Node[] = [
    ...own,
    ...edits.map((e) => ({
      id: e.yamlId,
      ...(e.label !== undefined && { label: e.label }),
      ...(e.absent && { absent: true as const }),
    })),
  ]
  const hasContent = nodes.length > 0

  const portCount = Object.values(observation?.nodes ?? {}).reduce(
    (n, o) => n + Object.keys(o.ports ?? {}).length,
    0,
  )
  return {
    network: hasContent
      ? {
          ...(handDrawn ? network : {}),
          nodes,
          links: handDrawn ? network.links.filter((l) => linkIsOwn(l, ownIds)) : [],
        }
      : null,
    edits,
    renamed,
    hidden,
    handDrawnNodes: own.length,
    handDrawnLinks: handDrawn ? network.links.filter((l) => linkIsOwn(l, ownIds)).length : 0,
    unresolved,
    droppedNodes: network.nodes.length - own.length - renamed,
    droppedPorts: portCount,
  }
}

const linkIsOwn = (link: inputModel.Link, ownIds: ReadonlySet<string>): boolean =>
  link.endpoints.every((e) => !('node' in e) || ownIds.has(e.node))

function exclusionIdentity(ex: NodeExclusion): Identity | null {
  const identity: Identity = {
    ...(ex.mgmtIp && { mgmtIp: ex.mgmtIp }),
    ...(ex.chassisId && { chassisId: ex.chassisId }),
    ...(ex.sysName && { sysName: ex.sysName }),
  }
  return Object.keys(identity).length > 0 ? identity : null
}

// --- the step ---------------------------------------------------------------

export interface RemovalReport {
  topologies: number
  skipped: number
  manualSources: number
  hideDisconnectedSet: number
  renamesCarried: number
  hidesCarried: number
  handDrawnNodes: number
  handDrawnLinks: number
  droppedNodes: number
  droppedPorts: number
  unresolved: string[]
  failed: number
  /** Topologies whose rows were deleted, to have their composition revision bumped. */
  touched: string[]
}

/**
 * Remove every project overlay: carry what a person said into a Manual source, then delete the
 * overlay's rows and its registry verdicts. `skip` names topologies whose overlay still holds
 * metrics bindings the backfill could not move yet; they are left whole for the next start.
 */
export async function removeOverlays(
  db: Database,
  sources: TopologySourcesService,
  skip: ReadonlySet<string>,
): Promise<RemovalReport> {
  const report: RemovalReport = {
    topologies: 0,
    skipped: 0,
    manualSources: 0,
    hideDisconnectedSet: 0,
    renamesCarried: 0,
    hidesCarried: 0,
    handDrawnNodes: 0,
    handDrawnLinks: 0,
    droppedNodes: 0,
    droppedPorts: 0,
    unresolved: [],
    failed: 0,
    touched: [],
  }
  const rows = db
    .query(
      `SELECT DISTINCT cs.topology_id AS id, t.name AS name
       FROM contribution_source cs JOIN topologies t ON t.id = cs.topology_id
       WHERE cs.source_id = ?`,
    )
    .all(LEGACY_OVERLAY_SOURCE_ID) as { id: string; name: string }[]

  for (const { id, name } of rows) {
    if (skip.has(id)) {
      report.skipped++
      continue
    }
    const overlay = buildNetwork(id, LEGACY_OVERLAY_SOURCE_ID, db)
    const plan = overlay ? planCarry(db, id, overlay) : null
    let created: string | null = null
    try {
      if (overlay?.drawing?.settings?.hideDisconnected === true) {
        db.query('UPDATE topologies SET hide_disconnected = 1 WHERE id = ?').run(id)
        report.hideDisconnectedSet++
      }
      if (plan?.network) {
        const manual = await createManualSource(db, sources, id, {
          name: `${name} edits`,
          priority: nextTopPriority(db, id),
        })
        created = manual.dataSourceId
        // Tie each edit to its device BEFORE the Manual source's network is recorded, so the
        // adopt of that network lands on the device instead of minting a second one.
        const unclaimed = new Set<string>(
          plan.edits
            .filter((e) => !claimNodeForSource(id, e.entityId, manual.dataSourceId, e.yamlId, db))
            .map((e) => e.yamlId),
        )
        for (const entityId of unclaimed) plan.unresolved.push(entityId)
        const network = {
          ...plan.network,
          name: `${name} edits`,
          nodes: plan.network.nodes.filter((n) => !unclaimed.has(n.id)),
        }
        const recorded = await new ObservationsService().record({
          topologyId: id,
          sourceId: manual.dataSourceId,
          capturedAt: Date.now(),
          status: 'ok',
          source: { network },
        })
        if (recorded.status === 'failed') {
          throw new Error(recorded.statusMessage ?? 'the Manual source was not accepted')
        }
        report.manualSources++
      }
      db.transaction(() => deleteOverlayRows(db, id))()
      report.topologies++
      report.touched.push(id)
      if (plan) {
        report.renamesCarried += plan.renamed
        report.hidesCarried += plan.hidden
        report.handDrawnNodes += plan.handDrawnNodes
        report.handDrawnLinks += plan.handDrawnLinks
        report.droppedNodes += plan.droppedNodes
        report.droppedPorts += plan.droppedPorts
        report.unresolved.push(...plan.unresolved.map((u) => `${id}:${u}`))
      }
    } catch (err) {
      report.failed++
      console.warn(
        `[Overlay] topology ${id}: kept its overlay for the next start:`,
        err instanceof Error ? err.message : err,
      )
      // Undo the half-made Manual source so a retry does not leave a second one.
      if (created) {
        db.query('DELETE FROM topology_data_sources WHERE data_source_id = ?').run(created)
        db.query('DELETE FROM data_sources WHERE id = ?').run(created)
        db.query('DELETE FROM contribution_source WHERE source_id = ?').run(created)
        db.query('DELETE FROM entity_element WHERE source_id = ?').run(created)
        db.query('DELETE FROM entity_identity_key WHERE source_id = ?').run(created)
        db.query('DELETE FROM topology_observations WHERE source_id = ?').run(created)
        report.manualSources = Math.max(0, report.manualSources - 1)
      }
    }
  }
  return report
}

/**
 * The overlay's contribution (its element, link and attachment rows go with the
 * `contribution_source` row by cascade) and its registry verdicts. The registry's entities stay:
 * other sources and the metrics mapping refer to them.
 */
function deleteOverlayRows(db: Database, topologyId: string): void {
  db.query('DELETE FROM contribution_source WHERE topology_id = ? AND source_id = ?').run(
    topologyId,
    LEGACY_OVERLAY_SOURCE_ID,
  )
  for (const table of ['entity_element', 'entity_identity_key', 'entity_retire_counter']) {
    db.query(`DELETE FROM ${table} WHERE topology_id = ? AND source_id = ?`).run(
      topologyId,
      LEGACY_OVERLAY_SOURCE_ID,
    )
  }
}
