import { createRoute, type OpenAPIHono } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import {
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
  unauthorizedResponse,
} from '../../openapi/common.js'
import {
  SettingKeyParamsSchema,
  SettingSchema,
  SettingsSchema,
  SettingsSuccessSchema,
  SettingValueSchema,
} from './schemas.js'

const notFoundResponse = {
  description: 'The setting does not exist',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const common = { tags: ['Settings'], security: protectedRouteSecurity }

const listRoute = createRoute({
  ...common,
  method: 'get',
  path: '/',
  summary: 'List settings',
  responses: {
    200: {
      description: 'All settings',
      content: { 'application/json': { schema: SettingsSchema } },
    },
    401: unauthorizedResponse,
  },
})
const getRoute = createRoute({
  ...common,
  method: 'get',
  path: '/{key}',
  summary: 'Get a setting',
  request: { params: SettingKeyParamsSchema },
  responses: {
    200: { description: 'Setting', content: { 'application/json': { schema: SettingSchema } } },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})
const setManyRoute = createRoute({
  ...common,
  method: 'put',
  path: '/',
  summary: 'Update settings',
  request: {
    body: { required: true, content: { 'application/json': { schema: SettingsSchema } } },
  },
  responses: {
    200: {
      description: 'Settings updated',
      content: { 'application/json': { schema: SettingsSuccessSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})
const setRoute = createRoute({
  ...common,
  method: 'put',
  path: '/{key}',
  summary: 'Update a setting',
  request: {
    params: SettingKeyParamsSchema,
    body: { required: true, content: { 'application/json': { schema: SettingValueSchema } } },
  },
  responses: {
    200: {
      description: 'Updated setting',
      content: { 'application/json': { schema: SettingSchema } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
})
const deleteRoute = createRoute({
  ...common,
  method: 'delete',
  path: '/{key}',
  summary: 'Delete a setting',
  request: { params: SettingKeyParamsSchema },
  responses: {
    200: {
      description: 'Setting deleted',
      content: { 'application/json': { schema: SettingsSuccessSchema } },
    },
    401: unauthorizedResponse,
    404: notFoundResponse,
  },
})

export function createSettingsApi(services: Pick<AppServices, 'settings'>): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.settings
  app.openapi(listRoute, (c) => c.json(service.list(), 200))
  app.openapi(getRoute, (c) => {
    const { key } = c.req.valid('param')
    const value = service.get(key)
    return value === null
      ? c.json({ error: 'Setting not found' }, 404)
      : c.json({ key, value }, 200)
  })
  app.openapi(setManyRoute, (c) => {
    service.setMany(c.req.valid('json'))
    return c.json({ success: true as const }, 200)
  })
  app.openapi(setRoute, (c) => {
    const { key } = c.req.valid('param')
    const { value } = c.req.valid('json')
    service.set(key, value)
    return c.json({ key, value }, 200)
  })
  app.openapi(deleteRoute, (c) =>
    service.delete(c.req.valid('param').key)
      ? c.json({ success: true as const }, 200)
      : c.json({ error: 'Setting not found' }, 404),
  )
  return app
}
