/**
 * Data Sources API
 * CRUD endpoints for data source management with plugin support
 */

import { Hono } from 'hono'
import { getAllPlugins } from '../plugins/loader.js'
import type { AlertQueryOptions } from '../plugins/types.js'
import { DataSourceService, SECRET_KEYS } from '../services/datasource.js'
import type { DataSourceInput } from '../types.js'

/**
 * Mask sensitive fields in config JSON
 */
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

export function createDataSourcesApi(): Hono {
  const app = new Hono()
  const service = new DataSourceService()

  // Get available plugin types
  app.get('/types', (c) => {
    const types = service.getRegisteredTypes()
    // Get loaded plugin info for configSchema
    const loadedPlugins = getAllPlugins()
    const pluginSchemas = new Map(loadedPlugins.map((p) => [p.id, p.configSchema]))

    // Only return serializable fields (exclude factory function)
    const serializable = types.map(({ type, displayName, capabilities }) => ({
      type,
      displayName,
      capabilities,
      configSchema: pluginSchemas.get(type),
    }))
    return c.json(serializable)
  })

  // List all data sources
  app.get('/', (c) => {
    const dataSources = service.list()
    // Mask sensitive config values
    const sanitized = dataSources.map((ds) => ({
      ...ds,
      configJson: maskConfigSecrets(ds.configJson),
    }))
    return c.json(sanitized)
  })

  // List data sources by capability
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

      // Validate configJson is valid JSON
      try {
        JSON.parse(body.configJson)
      } catch {
        return c.json({ error: 'configJson must be valid JSON' }, 400)
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
      console.error('[DataSources] Error creating data source:', err)
      return c.json({ error: 'Internal server error' }, 400)
    }
  })

  // Update data source
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as Partial<DataSourceInput>

      // Validate configJson if provided
      if (body.configJson !== undefined) {
        try {
          JSON.parse(body.configJson)
        } catch {
          return c.json({ error: 'configJson must be valid JSON' }, 400)
        }
      }

      const dataSource = await service.update(id, body)
      if (!dataSource) {
        return c.json({ error: 'Data source not found' }, 404)
      }
      return c.json({
        ...dataSource,
        configJson: maskConfigSecrets(dataSource.configJson),
      })
    } catch (err) {
      console.error('[DataSources] Error updating data source:', err)
      return c.json({ error: 'Internal server error' }, 400)
    }
  })

  // Delete data source
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
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
      console.error('[DataSources] Error getting hosts:', err)
      return c.json({ error: 'Internal server error' }, 500)
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
      console.error('[DataSources] Error getting host items:', err)
      return c.json({ error: 'Internal server error' }, 500)
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
      console.error('[DataSources] Error discovering metrics:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

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
      console.error('[DataSources] Error getting filter options:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Get webhook URL for Grafana data sources
  app.get('/:id/webhook-url', async (c) => {
    const id = c.req.param('id')
    const dataSource = service.get(id)
    if (!dataSource) {
      return c.json({ error: 'Data source not found' }, 404)
    }
    if (dataSource.type !== 'grafana') {
      return c.json({ error: 'Webhook URL only available for Grafana data sources' }, 400)
    }
    try {
      let config = JSON.parse(dataSource.configJson)
      if (!config.useWebhook) {
        return c.json({ error: 'Webhook mode is not enabled' }, 400)
      }
      if (!config.webhookSecret) {
        // Trigger secret generation via update
        const updated = await service.update(id, { configJson: dataSource.configJson })
        if (!updated) return c.json({ error: 'Failed to generate webhook secret' }, 500)
        config = JSON.parse(updated.configJson)
      }
      return c.json({
        webhookPath: `/api/webhooks/grafana/${config.webhookSecret}`,
      })
    } catch {
      return c.json({ error: 'Invalid configuration' }, 500)
    }
  })

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
    const VALID_SEVERITIES = ['critical', 'high', 'warning', 'info'] as const
    if (
      minSeverity &&
      !VALID_SEVERITIES.includes(minSeverity as (typeof VALID_SEVERITIES)[number])
    ) {
      return c.json({ error: 'Invalid minSeverity value' }, 400)
    }
    if (minSeverity) {
      options.minSeverity = minSeverity as AlertQueryOptions['minSeverity']
    }

    try {
      const alerts = await service.getAlerts(id, options)
      return c.json(alerts)
    } catch (err) {
      console.error('[DataSources] Error getting alerts:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  return app
}
