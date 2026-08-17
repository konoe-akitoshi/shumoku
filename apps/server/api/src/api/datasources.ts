/**
 * Data Sources API
 * CRUD endpoints for data source management with plugin support
 */

import { Hono } from 'hono'
import type { AlertQueryOptions } from '../plugins/types.js'
import { hasNativeApi } from '../plugins/types.js'
import { DataSourceService } from '../services/datasource.js'
import { getSignalStreams } from '../services/signal-streams.js'

// Secret fields (token / password / webhookSecret) are returned to the client
// in full. The config UI is admin-only (single-session auth — there is no
// non-admin role that can reach it), and the admin can already read the same
// values straight from the database, so the form masks them with a reveal
// toggle rather than withholding them. Revisit toward a gated reveal-on-demand
// endpoint if Shumoku ever gains multi-user roles or at-rest config encryption.

export function createDataSourcesApi(): Hono {
  const app = new Hono()
  const service = new DataSourceService()

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
