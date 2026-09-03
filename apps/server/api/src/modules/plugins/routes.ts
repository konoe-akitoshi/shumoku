import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices, PluginInfoView, PluginMutationResult } from '../../app/services.js'
import {
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'
import {
  DeletePluginQuerySchema,
  InstallPluginFormSchema,
  InstallPluginJsonSchema,
  PluginIdParamsSchema,
  PluginInfoSchema,
  PluginListSchema,
  PluginManifestSchema,
  PluginSuccessSchema,
  ReloadPluginsResultSchema,
  SetPluginEnabledSchema,
} from './schemas.js'

const errorResponses = {
  400: badRequestResponse,
  404: {
    description: 'Plugin not found',
    content: { 'application/json': { schema: ErrorSchema } },
  },
  500: {
    description: 'Plugin operation failed',
    content: { 'application/json': { schema: ErrorSchema } },
  },
} as const

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Plugins'],
  summary: 'List installed plugins',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Installed plugins',
      content: { 'application/json': { schema: PluginListSchema } },
    },
  },
})

const manifestRoute = createRoute({
  method: 'get',
  path: '/{id}/manifest',
  tags: ['Plugins'],
  summary: 'Get an external plugin manifest',
  security: protectedRouteSecurity,
  request: { params: PluginIdParamsSchema },
  responses: {
    200: {
      description: 'Plugin manifest',
      content: { 'application/json': { schema: PluginManifestSchema } },
    },
    400: errorResponses[400],
    404: errorResponses[404],
    500: errorResponses[500],
  },
})

const installRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Plugins'],
  summary: 'Install an external plugin',
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: InstallPluginJsonSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Installed plugin',
      content: { 'application/json': { schema: PluginInfoSchema } },
    },
    400: errorResponses[400],
    404: errorResponses[404],
    500: errorResponses[500],
  },
})

const uploadRoute = createRoute({
  method: 'post',
  path: '/upload',
  tags: ['Plugins'],
  summary: 'Install an external plugin from a ZIP archive',
  security: protectedRouteSecurity,
  request: {
    body: {
      required: true,
      content: { 'multipart/form-data': { schema: InstallPluginFormSchema } },
    },
  },
  responses: {
    201: {
      description: 'Installed plugin',
      content: { 'application/json': { schema: PluginInfoSchema } },
    },
    400: errorResponses[400],
    404: errorResponses[404],
    500: errorResponses[500],
  },
})

const setEnabledRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Plugins'],
  summary: 'Enable or disable an external plugin',
  security: protectedRouteSecurity,
  request: {
    params: PluginIdParamsSchema,
    body: { required: true, content: { 'application/json': { schema: SetPluginEnabledSchema } } },
  },
  responses: {
    200: {
      description: 'Plugin state updated',
      content: { 'application/json': { schema: PluginSuccessSchema } },
    },
    400: errorResponses[400],
    404: errorResponses[404],
    500: errorResponses[500],
  },
})

const removeRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Plugins'],
  summary: 'Remove an external plugin',
  security: protectedRouteSecurity,
  request: { params: PluginIdParamsSchema, query: DeletePluginQuerySchema },
  responses: {
    200: {
      description: 'Plugin removed',
      content: { 'application/json': { schema: PluginSuccessSchema } },
    },
    400: errorResponses[400],
    404: errorResponses[404],
    500: errorResponses[500],
  },
})

const reloadRoute = createRoute({
  method: 'post',
  path: '/reload',
  tags: ['Plugins'],
  summary: 'Reload external plugins',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Reload result',
      content: { 'application/json': { schema: ReloadPluginsResultSchema } },
    },
    400: errorResponses[400],
    404: errorResponses[404],
    500: errorResponses[500],
  },
})

function errorResponse<T>(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  result: PluginMutationResult<T>,
) {
  if (result.ok) throw new Error('Expected plugin operation failure')
  return c.json({ error: result.error }, result.status)
}

export function createPluginApi(services: Pick<AppServices, 'plugins'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.plugins

  app.openapi(listRoute, (c) => c.json(service.list(), 200))
  app.openapi(manifestRoute, async (c) => {
    const result = await service.getManifest(c.req.valid('param').id)
    return result.ok ? c.json(result.value, 200) : errorResponse(c, result)
  })
  app.openapi(installRoute, async (c) => {
    const input = c.req.valid('json')
    const result: PluginMutationResult<PluginInfoView> = input.url
      ? await service.installFromUrl(input.url, input.subdirectory)
      : await service.installFromPath(input.path ?? '')
    return result.ok ? c.json(result.value, 201) : errorResponse(c, result)
  })
  app.openapi(uploadRoute, async (c) => {
    const form = c.req.valid('form')
    const result = await service.installFromZip(
      new Uint8Array(await form.file.arrayBuffer()),
      form.subdirectory,
    )
    return result.ok ? c.json(result.value, 201) : errorResponse(c, result)
  })
  app.openapi(setEnabledRoute, async (c) => {
    const result = await service.setEnabled(c.req.valid('param').id, c.req.valid('json').enabled)
    return result.ok ? c.json(result.value, 200) : errorResponse(c, result)
  })
  app.openapi(removeRoute, async (c) => {
    const result = await service.remove(c.req.valid('param').id, c.req.valid('query').deleteFiles)
    return result.ok ? c.json(result.value, 200) : errorResponse(c, result)
  })
  app.openapi(reloadRoute, async (c) => {
    const result = await service.reload()
    return result.ok ? c.json(result.value, 200) : errorResponse(c, result)
  })
  return app
}
