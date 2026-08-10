/**
 * API Router
 * Combines all API endpoints
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
import type { AppServices } from '../app/services.js'
import { authMiddleware } from '../middleware/auth.js'
import { createAdminApi } from '../modules/admin/routes.js'
import { createHealthApi, createSystemApi } from '../modules/system/routes.js'
import { createAuthApi } from './auth.js'
import { createDashboardsApi } from './dashboards.js'
import { createDataSourcesApi } from './datasources.js'
import { createDiscoveryPolicyApi } from './discovery-policy.js'
import { createObservationsRoute, createScanRoute } from './observations.js'
import { createPluginsApi } from './plugins.js'
import { createSettingsApi } from './settings.js'
import { createShareApi } from './share.js'
import { createTopologiesApi } from './topologies.js'
import { topologySourcesApi } from './topology-sources.js'
import { webhooksApi } from './webhooks.js'

export function createApiRouter(services: AppServices): OpenAPIHono {
  const api = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'Invalid request' }, 400)
      return undefined
    },
  })

  api.openAPIRegistry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'shumoku_session',
    description: 'Browser administrator session',
  })
  api.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: '256-bit development token',
    description: 'Loopback-only development automation credential',
  })

  // Public routes (must be before auth middleware)
  api.route('/auth', createAuthApi())
  api.route('/share', createShareApi())
  api.route('/health', createHealthApi(services))
  api.get('/runtime.js', (c) => {
    c.header('Content-Type', 'application/javascript')
    c.header('Cache-Control', 'public, max-age=86400')
    return c.body(INTERACTIVE_IIFE)
  })

  // Apply authentication middleware to all subsequent routes
  api.use('*', authMiddleware)

  // Mount API routes
  api.route('/dashboards', createDashboardsApi())
  api.route('/datasources', createDataSourcesApi())
  api.route('/datasources', createScanRoute()) // POST /datasources/:id/scan
  api.route('/plugins', createPluginsApi())
  api.route('/topologies', createTopologiesApi())
  api.route('/topologies', topologySourcesApi) // Nested: /topologies/:id/sources
  api.route('/topologies', createObservationsRoute()) // /topologies/:id/observations + /resolved
  api.route('/topologies', createDiscoveryPolicyApi()) // /topologies/:id/discovery-policy
  api.route('/settings', createSettingsApi())
  api.route('/system', createSystemApi(services))
  api.route('/admin', createAdminApi(services))
  api.route('/webhooks', webhooksApi)

  api.doc31('/openapi.json', (c) => ({
    openapi: '3.1.0',
    info: {
      title: 'Shumoku Server API',
      version: services.system.getBuildInfo().version,
      description:
        'Machine-readable contract for Shumoku management and diagnostics. Existing endpoints are being migrated incrementally.',
    },
    servers: [{ url: `${new URL(c.req.url).origin}/api`, description: 'Current server' }],
  }))

  return api
}
