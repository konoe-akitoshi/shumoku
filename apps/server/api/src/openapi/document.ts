import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../app/services.js'
import { createAdminApi } from '../modules/admin/routes.js'
import { createAuthApi } from '../modules/auth/routes.js'
import { createDashboardApi } from '../modules/dashboards/routes.js'
import { createDataSourceOperationsApi } from '../modules/data-sources/operations.js'
import { createDataSourceCrudApi } from '../modules/data-sources/routes.js'
import { createDataSourceRuntimeApi } from '../modules/data-sources/runtime.js'
import { createDataSourceScanApi } from '../modules/data-sources/scan.js'
import { createDiscoveryPolicyApi } from '../modules/discovery-policy/routes.js'
import { createPluginApi } from '../modules/plugins/routes.js'
import { createSettingsApi } from '../modules/settings/routes.js'
import { createShareApi } from '../modules/share/routes.js'
import { createHealthApi, createSystemApi } from '../modules/system/routes.js'
import { createTopologyCrudApi } from '../modules/topologies/routes.js'
import { createTopologyMappingApi } from '../modules/topology-mappings/routes.js'
import { createTopologyObservationApi } from '../modules/topology-observations/routes.js'
import { createTopologyQueryApi } from '../modules/topology-queries/routes.js'
import { createTopologySourceApi } from '../modules/topology-sources/routes.js'
import { createTopologySyncApi } from '../modules/topology-sync/routes.js'
import { createWebhookApi } from '../modules/webhooks/routes.js'
import { createOpenAPIApp, registerSecuritySchemes } from './common.js'

interface OpenApiDocumentOptions {
  version: string
  serverUrl: string
  serverDescription?: string
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'])

function operationId(method: string, path: string): string {
  const suffix = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const parameter = /^\{(.+)\}$/.exec(segment)?.[1]
      const words = (parameter ? `by-${parameter}` : segment).split(/[^a-zA-Z0-9]+/).filter(Boolean)
      return words.map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join('')
    })
    .join('')
  return `${method.toLowerCase()}${suffix || 'Root'}`
}

function addOperationIds<T>(document: T): T {
  const result = structuredClone(document)
  if (!result || typeof result !== 'object' || !('paths' in result)) return result
  const paths = result.paths
  if (!paths || typeof paths !== 'object') return result

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== 'object') continue
      if (!('operationId' in operation) || typeof operation.operationId !== 'string') {
        Object.assign(operation, { operationId: operationId(method, path) })
      }
    }
  }
  return result
}

export function registerPublicContractRoutes(app: OpenAPIHono, services: AppServices): void {
  app.route('/auth', createAuthApi(services))
  app.route('/health', createHealthApi(services))
  app.route('/share', createShareApi(services))
}

export function registerProtectedContractRoutes(app: OpenAPIHono, services: AppServices): void {
  app.route('/datasources', createDataSourceOperationsApi(services))
  app.route('/datasources', createDataSourceRuntimeApi(services))
  app.route('/datasources', createDataSourceScanApi(services))
  app.route('/dashboards', createDashboardApi(services))
  app.route('/settings', createSettingsApi(services))
  app.route('/plugins', createPluginApi(services))
  app.route('/datasources', createDataSourceCrudApi(services))
  app.route('/topologies', createTopologyCrudApi(services))
  app.route('/topologies', createTopologyObservationApi(services))
  app.route('/topologies', createTopologyMappingApi(services))
  app.route('/topologies', createTopologyQueryApi(services))
  app.route('/topologies', createTopologySourceApi(services))
  app.route('/topologies', createTopologySyncApi(services))
  app.route('/topologies', createDiscoveryPolicyApi(services))
  app.route('/webhooks', createWebhookApi(services))
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

  return addOperationIds(
    contract.getOpenAPI31Document({
      openapi: '3.1.0',
      info: {
        title: 'Shumoku Server API',
        version: options.version,
        description:
          'Authoritative machine-readable contract for Shumoku management, automation, and diagnostics.',
      },
      servers: [
        {
          url: options.serverUrl,
          description: options.serverDescription ?? 'Shumoku Server API',
        },
      ],
    }),
  )
}
