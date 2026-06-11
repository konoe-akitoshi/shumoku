/**
 * Topology Data Sources API Routes
 * Manages the relationship between topologies and data sources
 */

import type { NetworkGraph } from '@shumoku/core'
import { Hono } from 'hono'
import { parseSyncOptions } from '../plugins/sync-options.js'
import { hasAutoscanCapability, hasTopologyCapability } from '../plugins/types.js'
import { DataSourceService } from '../services/datasource.js'
import { resolveCredentialsForAutoscan } from '../services/discovery-scheduler.js'
import { ObservationsService } from '../services/observations.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import type {
  LinkContribution,
  NodeContribution,
  SyncMode,
  TopologyDataSourceInput,
} from '../types.js'
import { mergeProbeIntoSnapshot } from './probe-merge.js'
import { getTopologyService } from './topologies.js'

// Lazy initialization to avoid database access at module load time
let _topologySourcesService: TopologySourcesService | null = null
let _dataSourceService: DataSourceService | null = null

function getTopologySourcesService() {
  if (!_topologySourcesService) {
    _topologySourcesService = new TopologySourcesService()
  }
  return _topologySourcesService
}

function getDataSourceService() {
  if (!_dataSourceService) {
    _dataSourceService = new DataSourceService()
  }
  return _dataSourceService
}

/**
 * Validate the per-source composition-mode knobs (topology-source-modes.md).
 * Returns an error string, or null when valid. Absent fields are valid (they
 * fall back to the Additive defaults).
 */
function validateCompositionModes(body: {
  nodeContribution?: unknown
  linkContribution?: unknown
}): string | null {
  if (
    body.nodeContribution !== undefined &&
    !['scoop', 'anchor'].includes(String(body.nodeContribution))
  )
    return "nodeContribution must be 'scoop' or 'anchor'"
  if (
    body.linkContribution !== undefined &&
    !['add', 'update'].includes(String(body.linkContribution))
  )
    return "linkContribution must be 'add' or 'update'"
  return null
}

export const topologySourcesApi = new Hono()

/**
 * List all data sources for a topology
 * GET /api/topologies/:topologyId/sources
 */
topologySourcesApi.get('/:topologyId/sources', async (c) => {
  const { topologyId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const sources = getTopologySourcesService().listByTopology(topologyId)
  return c.json(sources)
})

/**
 * Add a data source to a topology.
 * POST /api/topologies/:topologyId/sources
 *
 * Two shapes:
 *  (a) `{ dataSourceId, purpose, ... }` — attach an existing source
 *      (NetBox, SNMP, etc. shared across topologies).
 *  (b) `{ type: 'manual', purpose? }` — inline-create a Manual data
 *      source and attach it in one step. Manual is a fully uniform
 *      source (no cardinality / sharing constraints) — same as any
 *      other; this shape is just a convenience.
 */
topologySourcesApi.post('/:topologyId/sources', async (c) => {
  const { topologyId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const body = (await c.req.json()) as TopologyDataSourceInput & {
    type?: string
  }

  // Inline-create path: `{ type: 'manual' }` (purpose defaults to 'topology').
  // Convenience: create a fresh Manual data source and attach it in one step.
  // Manual is a fully uniform source (no cardinality / sharing constraints).
  if (body.type === 'manual') {
    const purpose = body.purpose ?? 'topology'
    try {
      const newSource = await getTopologyService().attachManualSource(topologyId, purpose)
      return c.json(newSource, 201)
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to attach Manual' },
        500,
      )
    }
  }

  // Existing-data-source path
  if (!body.dataSourceId || !body.purpose) {
    return c.json({ error: 'dataSourceId and purpose are required' }, 400)
  }

  const modeError = validateCompositionModes(body)
  if (modeError) return c.json({ error: modeError }, 400)

  // Verify data source exists
  const dataSource = getDataSourceService().get(body.dataSourceId)
  if (!dataSource) {
    return c.json({ error: 'Data source not found' }, 404)
  }

  // Check if already exists
  const existing = getTopologySourcesService().find(topologyId, body.dataSourceId, body.purpose)
  if (existing) {
    return c.json({ error: 'This data source is already linked with this purpose' }, 409)
  }

  try {
    const source = await getTopologySourcesService().add(topologyId, body)
    // Attaching a source changes the resolve input set → invalidate.
    getTopologyService().clearCacheEntry(topologyId)
    return c.json(source, 201)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to add data source' },
      500,
    )
  }
})

/**
 * Update a topology data source
 * PUT /api/topologies/:topologyId/sources/:sourceId
 */
topologySourcesApi.put('/:topologyId/sources/:sourceId', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const existing = getTopologySourcesService().get(sourceId)
  if (!existing || existing.topologyId !== topologyId) {
    return c.json({ error: 'Topology data source not found' }, 404)
  }

  const body = await c.req.json<{
    syncMode?: SyncMode
    priority?: number
    optionsJson?: string
    nodeContribution?: NodeContribution
    linkContribution?: LinkContribution
  }>()

  const modeError = validateCompositionModes(body)
  if (modeError) return c.json({ error: modeError }, 400)

  const updated = getTopologySourcesService().update(sourceId, body)
  if (!updated) {
    return c.json({ error: 'Failed to update' }, 500)
  }

  // Priority feeds the resolver's field merge → invalidate.
  getTopologyService().clearCacheEntry(topologyId)
  return c.json(updated)
})

/**
 * Remove a data source from a topology
 * DELETE /api/topologies/:topologyId/sources/:sourceId
 */
topologySourcesApi.delete('/:topologyId/sources/:sourceId', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const existing = getTopologySourcesService().get(sourceId)
  if (!existing || existing.topologyId !== topologyId) {
    return c.json({ error: 'Topology data source not found' }, 404)
  }

  const deleted = getTopologySourcesService().remove(sourceId)
  if (!deleted) {
    return c.json({ error: 'Failed to delete' }, 500)
  }

  // Detaching the TOPOLOGY attachment also purges this source's observed data
  // (audit snapshots + the canonical contribution). Without it, the data lingers
  // and a later re-attach silently resurrects it on the next resolve() — no Sync
  // required — breaking the "attach is config-only, no data until you Sync" model.
  // GUARD by purpose: a source can be attached for BOTH topology and metrics; the
  // observed contribution is keyed by data-source id alone, so purging on a
  // METRICS detach would wrongly wipe the still-attached topology contribution
  // and its history. The topology attach-row FK cascade already drops the
  // contribution; deleteForSource here cleans the audit log to match.
  if (existing.purpose === 'topology') {
    new ObservationsService().deleteForSource(topologyId, existing.dataSourceId)
  }

  // Detaching a source removes it from the resolve input set → invalidate.
  getTopologyService().clearCacheEntry(topologyId)
  return c.json({ success: true })
})

/**
 * Clear one source's CONTRIBUTION without detaching it: delete its observation
 * snapshots, then invalidate so resolve() re-stitches from the remaining
 * sources (entities only this source asserted disappear by orphan sweep).
 * The attachment + its config (priority / scope) stay. See
 * topology-ui-ia.md § "Per-source operations".
 * POST /api/topologies/:topologyId/sources/:sourceId/clear
 * (`:sourceId` is the data-source id, matching the sync routes.)
 */
topologySourcesApi.post('/:topologyId/sources/:sourceId/clear', async (c) => {
  const { topologyId, sourceId } = c.req.param()
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }
  const deleted = new ObservationsService().deleteForSource(topologyId, sourceId)
  getTopologyService().clearCacheEntry(topologyId)
  return c.json({ success: true, deleted })
})

/**
 * Bulk replace all sources for a topology
 * PUT /api/topologies/:topologyId/sources
 */
topologySourcesApi.put('/:topologyId/sources', async (c) => {
  const { topologyId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const body = await c.req.json<{ sources: TopologyDataSourceInput[] }>()

  if (!Array.isArray(body.sources)) {
    return c.json({ error: 'sources array is required' }, 400)
  }

  // Validate all data sources exist
  for (const source of body.sources) {
    if (!source.dataSourceId || !source.purpose) {
      return c.json({ error: 'Each source must have dataSourceId and purpose' }, 400)
    }
    const ds = getDataSourceService().get(source.dataSourceId)
    if (!ds) {
      return c.json({ error: `Data source ${source.dataSourceId} not found` }, 404)
    }
  }

  try {
    const sources = await getTopologySourcesService().replaceAll(topologyId, body.sources)
    // Replacing the source set changes resolve inputs → invalidate.
    getTopologyService().clearCacheEntry(topologyId)
    return c.json(sources)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update sources' },
      500,
    )
  }
})

/**
 * Sync ONE attached topology source.
 *
 * POST /api/topologies/:topologyId/sources/:sourceId/sync
 *
 * `:sourceId` refers to the underlying **data_source.id** (the source
 * type configuration, e.g. one Network Discovery setup), not the
 * `topology_data_sources.id` junction-row id. We disambiguate by
 * looking up the attachment via `(topologyId, dataSourceId, 'topology')`.
 *
 * Capability dispatch (autoscan → scan(), else fetchTopology()),
 * records the result as an observation snapshot, updates the
 * retraction hysteresis counter, and invalidates the parsed-topology
 * cache so the next render runs resolve(). This records ONLY this source's
 * own contribution; the project overlay (operator curation) and other
 * sources' contributions are never touched here.
 *
 * Replaces the legacy multi-source-merge implementation; multi-source
 * folding now happens at read time inside `resolve()`. Use
 * `/sync-from-source` for the "all sources at once" operation.
 */
/**
 * Targeted probe of an attached source.
 *
 * POST /api/topologies/:topologyId/sources/:sourceId/probe
 * body: `{ seeds: string[] }`
 *
 * Semantically distinct from `/sync`: probe re-checks a specific
 * subset of targets ("just this device, right now"), where sync
 * re-runs the source 's full configured scope. The Discovery tab 's
 * per-node "Probe" affordance hits this endpoint with the node 's
 * `mgmtIp` as its single seed.
 *
 * Only meaningful for plugins that implement `AutoscanCapable`
 * (the seeds list maps to `AutoscanInput.seeds`). Other plugin
 * shapes get a 400 — there 's no "probe this NetBox device" because
 * NetBox already returns the whole inventory in one go.
 */
topologySourcesApi.post('/:topologyId/sources/:sourceId/probe', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }
  const attached = getTopologySourcesService().find(topologyId, sourceId, 'topology')
  if (!attached) {
    return c.json({ error: 'Source is not attached to this topology with topology purpose' }, 404)
  }
  const plugin = getDataSourceService().getPlugin(sourceId)
  if (!plugin) {
    return c.json({ error: 'Data source not found' }, 404)
  }
  if (!hasAutoscanCapability(plugin)) {
    return c.json(
      {
        error: `Plugin ${plugin.type} doesn 't support targeted probe (no autoscan capability)`,
      },
      400,
    )
  }

  let seeds: string[] = []
  try {
    const body = (await c.req.json()) as { seeds?: unknown }
    if (Array.isArray(body.seeds)) {
      seeds = body.seeds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    }
  } catch {
    // Empty body treated as no-seeds — fall through to the validation below.
  }
  if (seeds.length === 0) {
    return c.json({ error: 'Body must include a non-empty `seeds` array' }, 400)
  }

  const capturedAt = Date.now()
  const observations = new ObservationsService()
  try {
    // Apply per-target credential overrides here too — even the ad-hoc
    // /probe endpoint (which passes specific seeds) should honor what
    // the operator configured on those nodes.
    const credentials = resolveCredentialsForAutoscan(topologyId, getTopologyService())
    const snapshot = await plugin.scan({ seeds, credentials })

    // A probe re-scans only the named seeds — its graph holds just those
    // nodes. Recording it verbatim would make it the source's *latest*
    // snapshot, and `latestPerSource` would then drop every node the probe
    // didn't touch. So merge the probe's nodes/links INTO the source's last
    // full snapshot: replace the probed nodes (and their incident links),
    // keep everything else. This makes "probe one node" actually update one
    // node instead of wiping the source's view.
    const prevLatest = observations.latestPerSource(topologyId).find((o) => o.sourceId === sourceId)
    const merged = mergeProbeIntoSnapshot(prevLatest?.graph ?? null, snapshot.graph, seeds)

    // Status: a failed/empty probe must record its OWN status — never inherit
    // the previous snapshot's 'ok', or a failed probe would masquerade as a
    // healthy sync. Only when the probe itself succeeded AND we actually merged
    // into the prior full snapshot do we inherit the base's confidence (the
    // merged graph is as complete as the base was, not the probe's narrow 'ok'
    // that only spoke for the seeds).
    const mergedIntoBase = prevLatest !== undefined && merged !== snapshot.graph
    const status =
      snapshot.status === 'ok' && mergedIntoBase
        ? (prevLatest?.status ?? 'partial')
        : snapshot.status
    const observation = await observations.record({
      topologyId,
      sourceId,
      capturedAt,
      status,
      statusMessage: snapshot.statusMessage,
      graph: merged,
    })
    observations.updateHysteresis(
      topologyId,
      sourceId,
      snapshot.status === 'failed' ? 'failed' : 'ok',
      capturedAt,
    )
    getTopologyService().clearCacheEntry(topologyId)
    getTopologySourcesService().updateLastSynced(attached.id)
    return c.json({
      observation,
      snapshot: {
        status: snapshot.status,
        statusMessage: snapshot.statusMessage,
        capturedAt: snapshot.capturedAt,
        warnings: snapshot.warnings,
        graph: merged,
      },
    })
  } catch (err) {
    return c.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    )
  }
})

topologySourcesApi.post('/:topologyId/sources/:sourceId/sync', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  // Resolve the attachment by (topology, dataSource, purpose='topology').
  const attached = getTopologySourcesService().find(topologyId, sourceId, 'topology')
  if (!attached) {
    return c.json({ error: 'Source is not attached to this topology with topology purpose' }, 404)
  }

  const plugin = getDataSourceService().getPlugin(sourceId)
  if (!plugin) {
    return c.json({ error: 'Data source not found' }, 404)
  }

  const capturedAt = Date.now()
  let graph: NetworkGraph | null = null
  let status: 'ok' | 'partial' | 'failed' | 'empty' = 'ok'
  let statusMessage: string | undefined
  let warnings: string[] | undefined

  try {
    if (hasAutoscanCapability(plugin)) {
      const credentials = resolveCredentialsForAutoscan(topologyId, getTopologyService())
      const snapshot = await plugin.scan({ seeds: [], credentials })
      graph = snapshot.graph
      status = snapshot.status
      statusMessage = snapshot.statusMessage
      warnings = snapshot.warnings
    } else if (hasTopologyCapability(plugin)) {
      const opts = parseSyncOptions(plugin.type, attached.optionsJson)
      graph = await plugin.fetchTopology(opts)
      status = graph?.nodes && graph.nodes.length > 0 ? 'ok' : 'empty'
    } else {
      return c.json(
        {
          error: `Plugin ${plugin.type} cannot supply topology (no autoscan or topology capability)`,
        },
        400,
      )
    }
  } catch (err) {
    status = 'failed'
    statusMessage = err instanceof Error ? err.message : String(err)
    graph = null
  }

  const observations = new ObservationsService()
  const observation = await observations.record({
    topologyId,
    sourceId,
    capturedAt,
    status,
    statusMessage,
    graph,
  })
  observations.updateHysteresis(
    topologyId,
    sourceId,
    status === 'failed' ? 'failed' : 'ok',
    capturedAt,
  )
  getTopologyService().clearCacheEntry(topologyId)
  // Stamp the legacy lastSyncedAt for UI surfaces that read it.
  getTopologySourcesService().updateLastSynced(attached.id)

  return c.json({
    observation,
    snapshot: {
      status,
      statusMessage,
      capturedAt,
      warnings,
      graph,
    },
  })
})
