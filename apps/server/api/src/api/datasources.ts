/**
 * Data Sources API
 * CRUD endpoints for data source management with plugin support
 */

import { hasConfigOptions, hasConnectionInfo, validateAgainstSchema } from '@shumoku/core'
import { Hono } from 'hono'
import { getAllPlugins } from '../plugins/loader.js'
import type { AlertQueryOptions } from '../plugins/types.js'
import { hasNativeApi } from '../plugins/types.js'
import { DataSourceService } from '../services/datasource.js'
import { getSignalStreams } from '../services/signal-streams.js'
import type { DataSourceInput } from '../types.js'
import { getTopologyService } from './topologies.js'

/**
 * Mask sensitive fields in config JSON
 */
const SECRET_KEYS = new Set(['token', 'password', 'secret', 'apikey', 'apiKey'])

function maskConfigSecrets(configJson: string): string {
  try {
    const config = JSON.parse(configJson)
    maskSecrets(config)
    return JSON.stringify(config)
  } catch {
    return configJson
  }
}

function maskSecrets(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (SECRET_KEYS.has(key) && typeof value === 'string') {
      obj[key] = '••••••••'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      maskSecrets(value as Record<string, unknown>)
    }
  }
}

/**
 * Validate a config_json string against the plugin's configSchema using core's
 * shared validator — the same one the web form renders from (§3.5). Returns an
 * error message, or null when valid (or when the plugin declares no schema, in
 * which case config is opaque and passes through).
 */
function validateConfigForType(type: string, configJson: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(configJson)
  } catch {
    return 'configJson must be valid JSON'
  }
  const schema = getAllPlugins().find((p) => p.id === type)?.configSchema
  if (!schema) return null
  const result = validateAgainstSchema(schema, parsed)
  if (result.ok) return null
  return result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')
}

export function createDataSourcesApi(): Hono {
  const app = new Hono()
  const service = new DataSourceService()

  // Get available plugin types for the +Add Source picker. Manual is
  // included like any other source — the UI renders a name-only form
  // for it (no URL/token). Manual is fully uniform: no cardinality or
  // sharing constraint at attach time.
  app.get('/types', (c) => {
    const types = service.getRegisteredTypes()
    // configSchema / optionsSchema now flow from the registry for bundled
    // plugins too (Phase 2/4a), so getAllPlugins carries both for bundled and
    // external alike — the web renders one generic form from them (no per-type
    // branch).
    const loadedPlugins = getAllPlugins()
    const pluginSchemas = new Map(loadedPlugins.map((p) => [p.id, p.configSchema]))
    const pluginOptionsSchemas = new Map(loadedPlugins.map((p) => [p.id, p.optionsSchema]))

    // Only return serializable fields (exclude factory function)
    const serializable = types.map(({ type, displayName, capabilities }) => ({
      type,
      displayName,
      capabilities,
      configSchema: pluginSchemas.get(type),
      optionsSchema: pluginOptionsSchemas.get(type),
    }))
    return c.json(serializable)
  })

  // Dynamic candidates for an `optionsSource` schema field (e.g. NetBox
  // site / tag / role). Instantiates the plugin with its stored config and asks
  // it for the options — the generic, capability-gated counterpart to the
  // per-plugin filter endpoints. Failures degrade to an empty list so the web
  // can fall back to free entry (never treats "no candidates" as broken).
  app.get('/:id/config-options/:key', async (c) => {
    const id = c.req.param('id')
    const key = c.req.param('key')
    const plugin = service.getPlugin(id)
    if (!plugin) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    if (!hasConfigOptions(plugin)) {
      return c.json({ options: [] })
    }
    try {
      const options = await plugin.getConfigOptions(key, {})
      return c.json({ options })
    } catch (err) {
      console.error('[DataSources] getConfigOptions failed:', err)
      return c.json({ options: [] })
    }
  })

  // Derived, display-only connection info (e.g. a webhook URL). The plugin
  // builds it from its config + the host-supplied origin; the web renders the
  // items generically (no per-plugin branch). `origin` is the public origin the
  // web is served from, so the URL is reachable by the upstream.
  app.get('/:id/connection-info', (c) => {
    const id = c.req.param('id')
    const plugin = service.getPlugin(id)
    if (!plugin || !hasConnectionInfo(plugin)) {
      return c.json({ items: [] })
    }
    const ds = service.get(id)
    const config = ds ? JSON.parse(ds.configJson) : {}
    const serverOrigin = c.req.query('origin') || new URL(c.req.url).origin
    try {
      const items = plugin.getConnectionInfo(config, { dataSourceId: id, serverOrigin })
      return c.json({ items })
    } catch (err) {
      console.error('[DataSources] getConnectionInfo failed:', err)
      return c.json({ items: [] })
    }
  })

  // List all data sources. Manual rows are included like any other
  // source — they show in the global list, can be attached to topologies,
  // etc. Migration 010 may have created several "Manual" rows (one per
  // existing topology) so the list can be noisy at first; users can
  // rename them from each detail page.
  app.get('/', (c) => {
    const dataSources = service.list()
    const sanitized = dataSources.map((ds) => ({
      ...ds,
      configJson: maskConfigSecrets(ds.configJson),
    }))
    return c.json(sanitized)
  })

  // List data sources by capability. Manual has no capabilities so it
  // won 't appear in any specific-capability list naturally.
  app.get('/by-capability/:capability', (c) => {
    const capability = c.req.param('capability') as 'topology' | 'metrics' | 'alerts'
    if (capability !== 'topology' && capability !== 'metrics' && capability !== 'alerts') {
      return c.json(
        { error: 'Invalid capability. Must be "topology", "metrics", or "alerts"' },
        400,
      )
    }
    const dataSources = service.listByCapability(capability)
    const sanitized = dataSources.map((ds) => ({
      ...ds,
      configJson: maskConfigSecrets(ds.configJson),
    }))
    return c.json(sanitized)
  })

  // Topologies that this data source is currently attached to.
  // Mainly used by the Manual datasource page to render "edit content
  // in <topology>" links — the editor itself lives under
  // /topologies/:topoId/sources/:sourceId/edit, so we need a way to
  // discover the parent(s) from the source side.
  app.get('/:id/topologies', (c) => {
    const id = c.req.param('id')
    if (!service.get(id)) return c.json({ error: 'Data source not found' }, 404)
    const db = (service as unknown as { db: import('bun:sqlite').Database }).db
    const rows = db
      .query(
        `SELECT t.id AS topology_id, t.name
         FROM topology_data_sources tds
         JOIN topologies t ON t.id = tds.topology_id
         WHERE tds.data_source_id = ?
         ORDER BY t.name ASC`,
      )
      .all(id) as { topology_id: string; name: string }[]
    return c.json(rows.map((r) => ({ topologyId: r.topology_id, name: r.name })))
  })

  // Get single data source
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const dataSource = service.get(id)
    if (!dataSource) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    return c.json({
      ...dataSource,
      configJson: maskConfigSecrets(dataSource.configJson),
    })
  })

  // Create new data source
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as DataSourceInput
      if (!body.name || !body.type || !body.configJson) {
        return c.json({ error: 'name, type, and configJson are required' }, 400)
      }

      // Validate configJson against the plugin's configSchema (authoritative).
      const configError = validateConfigForType(body.type, body.configJson)
      if (configError) {
        return c.json({ error: configError }, 400)
      }

      const dataSource = await service.create(body)
      return c.json(
        {
          ...dataSource,
          configJson: maskConfigSecrets(dataSource.configJson),
        },
        201,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update data source
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as Partial<DataSourceInput>

      // Validate configJson against the plugin's configSchema if provided.
      if (body.configJson !== undefined) {
        const existing = service.get(id)
        const type = body.type ?? existing?.type
        if (type) {
          const configError = validateConfigForType(type, body.configJson)
          if (configError) {
            return c.json({ error: configError }, 400)
          }
        }
      }

      const dataSource = await service.update(id, body)
      if (!dataSource) {
        return c.json({ error: 'Data source not found' }, 404)
      }
      // A config edit can change resolve inputs (priority / connection) →
      // invalidate attached topologies so they recompute.
      getTopologyService().clearCacheForDataSource(id)
      return c.json({
        ...dataSource,
        configJson: maskConfigSecrets(dataSource.configJson),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Delete data source
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    // Invalidate attached topologies BEFORE the delete cascades away the
    // topology_data_sources rows we'd otherwise look up.
    getTopologyService().clearCacheForDataSource(id)
    const deleted = service.delete(id)
    if (!deleted) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    return c.json({ success: true })
  })

  // Test connection
  app.post('/:id/test', async (c) => {
    const id = c.req.param('id')
    const result = await service.testConnection(id)
    // Update health status in database
    if (result.success) {
      service.updateHealthStatus(id, 'connected', result.message, 0)
    } else {
      const ds = service.get(id)
      service.updateHealthStatus(id, 'disconnected', result.message, (ds?.failCount ?? 0) + 1)
    }
    return c.json(result)
  })

  // Get hosts from data source (for mapping UI)
  app.get('/:id/hosts', async (c) => {
    const id = c.req.param('id')
    try {
      const hosts = await service.getHosts(id)
      return c.json(hosts)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get items for a specific host
  app.get('/:id/hosts/:hostId/items', async (c) => {
    const id = c.req.param('id')
    const hostId = c.req.param('hostId')
    try {
      const items = await service.getHostItems(id, hostId)
      return c.json(items)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get interface neighbours (LLDP/CDP) for a specific host
  app.get('/:id/hosts/:hostId/neighbors', async (c) => {
    const id = c.req.param('id')
    const hostId = c.req.param('hostId')
    try {
      const neighbors = await service.getInterfaceNeighbors(id, hostId)
      return c.json(neighbors)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Discover all metrics for a specific host
  app.get('/:id/hosts/:hostId/metrics', async (c) => {
    const id = c.req.param('id')
    const hostId = c.req.param('hostId')
    try {
      const metrics = await service.discoverMetrics(id, hostId)
      return c.json(metrics)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Dev-only: raw upstream-API passthrough for debugging. Lets a developer
  // call any native method (e.g. Zabbix's `item.get`, `host.get`) with arbitrary
  // params from the browser devtools without re-deploying server code.
  //
  // Gate is opt-in (must be NODE_ENV=development) rather than opt-out so a
  // forgotten env var in production doesn't expose credentials/upstream
  // arbitrary methods. The dev scripts already set NODE_ENV=development;
  // Dockerfile / start scripts deliberately leave it unset.
  if (process.env['NODE_ENV'] === 'development') {
    app.post('/:id/_native', async (c) => {
      const id = c.req.param('id')
      const plugin = service.getPlugin(id)
      if (!plugin) return c.json({ error: 'Data source not found' }, 404)
      if (!hasNativeApi(plugin)) {
        return c.json({ error: 'Plugin does not expose a native API' }, 400)
      }
      let body: { method?: unknown; params?: unknown }
      try {
        body = (await c.req.json()) as { method?: unknown; params?: unknown }
      } catch {
        return c.json({ error: 'Body must be JSON: {method, params}' }, 400)
      }
      if (typeof body.method !== 'string') {
        return c.json({ error: '`method` must be a string' }, 400)
      }
      const params =
        body.params && typeof body.params === 'object'
          ? (body.params as Record<string, unknown>)
          : {}
      try {
        const result = await plugin.nativeApi(body.method, params)
        return c.json({ result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 500)
      }
    })
  }

  // Get filter options (NetBox: sites & tags)
  app.get('/:id/filter-options', async (c) => {
    const id = c.req.param('id')
    try {
      const options = await service.getFilterOptions(id)
      if (!options) {
        return c.json({ error: 'Filter options not supported for this data source type' }, 400)
      }
      return c.json(options)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // (Removed /:id/webhook-url — the webhook URL is now derived generically via
  // the plugin's getConnectionInfo + the /:id/connection-info endpoint, with no
  // grafana-specific branch.)

  // Get alerts from a data source directly
  app.get('/:id/alerts', async (c) => {
    const id = c.req.param('id')

    if (!service.hasAlertsCapability(id)) {
      return c.json({ error: 'Data source does not support alerts' }, 400)
    }

    const options: AlertQueryOptions = {}
    const timeRange = c.req.query('timeRange')
    if (timeRange) {
      options.timeRange = Number.parseInt(timeRange, 10)
    }
    const activeOnly = c.req.query('activeOnly')
    if (activeOnly === 'true') {
      options.activeOnly = true
    }
    const minSeverity = c.req.query('minSeverity')
    if (minSeverity) {
      options.minSeverity = minSeverity as AlertQueryOptions['minSeverity']
    }

    try {
      const alerts = await service.getAlerts(id, options)
      // Alert stream (signal-streams.md): append state transitions.
      // Disappearance counts as resolution ONLY for an unfiltered active
      // query — a filtered fetch must never resolve alerts it didn't ask
      // about. Best-effort: stream failures never break the response.
      const unfiltered =
        options.timeRange === undefined && options.minSeverity === undefined && !options.activeOnly
      getSignalStreams()
        .ingestAlerts(id, null, alerts, { fullActiveSet: unfiltered })
        .catch((err) => console.error('[Datasources] alert stream ingest failed:', err))
      return c.json(alerts)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return app
}
