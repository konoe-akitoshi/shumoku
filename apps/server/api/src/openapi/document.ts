import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../app/services.js'
import { createAdminApi } from '../modules/admin/routes.js'
import { createDataSourceCrudApi } from '../modules/data-sources/routes.js'
import { createHealthApi, createSystemApi } from '../modules/system/routes.js'
import { createTopologyCrudApi } from '../modules/topologies/routes.js'
import { createOpenAPIApp, registerSecuritySchemes } from './common.js'

interface OpenApiDocumentOptions {
  version: string
  serverUrl: string
  serverDescription?: string
}

export function registerPublicContractRoutes(app: OpenAPIHono, services: AppServices): void {
  app.route('/health', createHealthApi(services))
}

export function registerProtectedContractRoutes(app: OpenAPIHono, services: AppServices): void {
  app.route('/datasources', createDataSourceCrudApi(services))
  app.route('/topologies', createTopologyCrudApi(services))
  app.route('/system', createSystemApi(services))
  app.route('/admin', createAdminApi(services))
}

export function createOpenApiDocument(
  services: AppServices,
  options: OpenApiDocumentOptions,
): ReturnType<OpenAPIHono['getOpenAPI31Document']> {
  const contract = createOpenAPIApp()
  registerSecuritySchemes(contract)
  registerPublicContractRoutes(contract, services)
  registerProtectedContractRoutes(contract, services)

  return contract.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'Shumoku Server API',
      version: options.version,
      description:
        'Machine-readable contract for Shumoku management and diagnostics. Existing endpoints are being migrated incrementally.',
    },
    servers: [
      {
        url: options.serverUrl,
        description: options.serverDescription ?? 'Shumoku Server API',
      },
    ],
  })
}
