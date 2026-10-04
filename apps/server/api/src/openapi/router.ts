import type { OpenAPIHono } from '@hono/zod-openapi'
import { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
import type { AppServices } from '../app/services.js'
import { authMiddleware } from '../middleware/auth.js'
import { csrfGuard } from '../middleware/csrf.js'
import { createOpenAPIApp, registerSecuritySchemes } from './common.js'
import {
  createOpenApiDocument,
  registerProtectedContractRoutes,
  registerPublicContractRoutes,
} from './document.js'

export function createApiRouter(services: AppServices): OpenAPIHono {
  const api = createOpenAPIApp()
  registerSecuritySchemes(api)

  // Before every route, public ones included (logout is a bodiless POST).
  api.use('*', csrfGuard)
  registerPublicContractRoutes(api, services)
  api.get('/runtime.js', (c) => {
    c.header('Content-Type', 'application/javascript')
    c.header('Cache-Control', 'public, max-age=86400')
    return c.body(INTERACTIVE_IIFE)
  })

  api.use('*', authMiddleware)
  registerProtectedContractRoutes(api, services)

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
