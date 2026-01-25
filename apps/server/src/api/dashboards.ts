/**
 * Dashboards API
 * CRUD endpoints for dashboard management
 */

import { Hono } from 'hono'
import { DashboardService } from '../services/dashboard.js'
import type { DashboardInput } from '../types.js'

// Singleton instance
let _dashboardService: DashboardService | null = null

export function getDashboardService(): DashboardService {
  if (!_dashboardService) {
    _dashboardService = new DashboardService()
  }
  return _dashboardService
}

export function createDashboardsApi(): Hono {
  const app = new Hono()
  const service = getDashboardService()

  // List all dashboards
  app.get('/', (c) => {
    const dashboards = service.list()
    return c.json(dashboards)
  })

  // Get single dashboard
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const dashboard = service.get(id)
    if (!dashboard) {
      return c.json({ error: 'Dashboard not found' }, 404)
    }
    return c.json(dashboard)
  })

  // Create new dashboard
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as DashboardInput
      if (!body.name) {
        return c.json({ error: 'name is required' }, 400)
      }

      // Set default layout if not provided
      if (!body.layoutJson) {
        body.layoutJson = JSON.stringify({
          columns: 12,
          rowHeight: 100,
          margin: 8,
          widgets: [],
        })
      }

      const dashboard = await service.create(body)
      return c.json(dashboard, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update dashboard
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as Partial<DashboardInput>
      const dashboard = service.update(id, body)
      if (!dashboard) {
        return c.json({ error: 'Dashboard not found' }, 404)
      }
      return c.json(dashboard)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Delete dashboard
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const deleted = service.delete(id)
    if (!deleted) {
      return c.json({ error: 'Dashboard not found' }, 404)
    }
    return c.json({ success: true })
  })

  return app
}
