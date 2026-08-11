/**
 * API Router
 * Combines all API endpoints
 */

import type { OpenAPIHono } from '@hono/zod-openapi'
import { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
import type { AppServices } from '../app/services.js'
import { authMiddleware } from '../middleware/auth.js'
import { createOpenAPIApp, registerSecuritySchemes } from '../openapi/common.js'
import {
  createOpenApiDocument,
  registerProtectedContractRoutes,
  registerPublicContractRoutes,
} from '../openapi/document.js'
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
  const api = createOpenAPIApp()
  registerSecuritySchemes(api)

  // Public routes (must be before auth middleware)
  api.route('/auth', createAuthApi())
  api.route('/share', createShareApi())
  registerPublicContractRoutes(api, services)
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
  registerProtectedContractRoutes(api, services)
  api.route('/topologies', createTopologiesApi())
  api.route('/topologies', topologySourcesApi) // Nested: /topologies/:id/sources
  api.route('/topologies', createObservationsRoute()) // /topologies/:id/observations + /resolved
  api.route('/topologies', createDiscoveryPolicyApi()) // /topologies/:id/discovery-policy
  api.route('/settings', createSettingsApi())
  api.route('/webhooks', webhooksApi)

  api.get('/openapi.json', (c) =>
    c.json(
      createOpenApiDocument(services, {
        version: services.system.getBuildInfo().version,
        serverUrl: `${new URL(c.req.url).origin}/api`,
        serverDescription: 'Current server',
      }),
    ),
  )

  return api
}
