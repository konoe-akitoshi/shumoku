/**
 * Data Sources API
 * CRUD endpoints for data source management with plugin support
 */

import { Hono } from 'hono'
import { DataSourceService } from '../services/datasource.js'
import type { DataSourceInput } from '../types.js'

/**
 * Mask sensitive fields in config JSON
 */
function maskConfigSecrets(configJson: string): string {
  try {
    const config = JSON.parse(configJson)
    if (config.token) {
      config.token = '••••••••'
    }
    if (config.password) {
      config.password = '••••••••'
    }
    return JSON.stringify(config)
  } catch {
    return configJson
  }
}

export function createDataSourcesApi(): Hono {
  const app = new Hono()
  const service = new DataSourceService()

  // Get available plugin types
  app.get('/types', (c) => {
    const types = service.getRegisteredTypes()
    // Only return serializable fields (exclude factory function)
    const serializable = types.map(({ type, displayName, capabilities }) => ({
      type,
      displayName,
      capabilities,
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
    const capability = c.req.param('capability') as 'topology' | 'metrics'
    if (capability !== 'topology' && capability !== 'metrics') {
      return c.json({ error: 'Invalid capability. Must be "topology" or "metrics"' }, 400)
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
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
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

      const dataSource = service.update(id, body)
      if (!dataSource) {
        return c.json({ error: 'Data source not found' }, 404)
      }
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

  return app
}
