/**
 * API Router
 * Combines all API endpoints
 */

import { Hono } from 'hono'
import { createDashboardsApi } from './dashboards.js'
import { createDataSourcesApi } from './datasources.js'
import { createPluginsApi } from './plugins.js'
import { createTopologiesApi } from './topologies.js'
import { createSettingsApi } from './settings.js'
import { topologySourcesApi } from './topology-sources.js'
import { webhooksApi } from './webhooks.js'
import { createAuthApi } from './auth.js'
import { createShareApi } from './share.js'
import { authMiddleware } from '../middleware/auth.js'
import { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'

export function createApiRouter(): Hono {
  const api = new Hono()

  // Public routes (must be before auth middleware)
  api.route('/auth', createAuthApi())
  api.route('/share', createShareApi())

  // Apply authentication middleware to all subsequent routes
  api.use('*', authMiddleware)

  // Mount API routes
  api.route('/dashboards', createDashboardsApi())
  api.route('/datasources', createDataSourcesApi())
  api.route('/plugins', createPluginsApi())
  api.route('/topologies', createTopologiesApi())
  api.route('/topologies', topologySourcesApi) // Nested: /topologies/:id/sources
  api.route('/settings', createSettingsApi())
  api.route('/webhooks', webhooksApi)

  // API health check
  api.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: Date.now() })
  })

  // Serve interactive runtime script
  api.get('/runtime.js', (c) => {
    c.header('Content-Type', 'application/javascript')
    c.header('Cache-Control', 'public, max-age=86400')
    return c.body(INTERACTIVE_IIFE)
  })

  return api
}
