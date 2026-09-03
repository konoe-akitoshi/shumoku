import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppServices } from '../../app/services.js'
import { createOpenAPIApp, ErrorSchema, protectedRouteSecurity } from '../../openapi/common.js'

const WebhookParamsSchema = z.object({
  type: z
    .string()
    .min(1)
    .openapi({ param: { name: 'type', in: 'path' } }),
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})
const WebhookQuerySchema = z.object({ secret: z.string().optional() })
const WebhookResultSchema = z
  .union([
    z.object({
      success: z.literal(true),
      topologyId: z.string(),
      nodeCount: z.number().int(),
      linkCount: z.number().int(),
    }),
    z.object({ success: z.literal(true), alertCount: z.number().int() }),
  ])
  .openapi('WebhookResult')
const HealthSchema = z.object({ status: z.literal('ok') }).openapi('WebhookHealth')
const errorResponse = {
  description: 'Webhook rejected',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const ingressRoute = createRoute({
  method: 'post',
  path: '/{type}/{id}',
  tags: ['Webhooks'],
  summary: 'Receive a data source webhook',
  security: [{ webhookHeader: [] }, { webhookQuery: [] }],
  request: {
    params: WebhookParamsSchema,
    query: WebhookQuerySchema,
    body: {
      required: false,
      content: {
        'application/json': { schema: z.record(z.string(), z.unknown()) },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook processed',
      content: { 'application/json': { schema: WebhookResultSchema } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
    500: errorResponse,
  },
})
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Webhooks'],
  summary: 'Check webhook ingress health',
  security: protectedRouteSecurity,
  responses: {
    200: {
      description: 'Webhook ingress is healthy',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
})

export function createWebhookApi(services: Pick<AppServices, 'webhooks'>): OpenAPIHono {
  const app = createOpenAPIApp()
  app.openapi(ingressRoute, async (c) => {
    const type = c.req.param('type')
    const id = c.req.param('id')
    if (!type || !id) return c.json({ error: 'Invalid webhook path' }, 400)
    const secret = c.req.header('x-webhook-secret') ?? c.req.query('secret') ?? null
    const payload = await c.req.json().catch(() => undefined)
    const result = await services.webhooks.handle(type, id, secret, payload)
    return result.ok ? c.json(result.value, 200) : c.json({ error: result.error }, result.status)
  })
  app.openapi(healthRoute, (c) => c.json({ status: 'ok' as const }, 200))
  return app
}
