import type { Alert, MetricsData, NetworkGraph } from '@shumoku/core'
import type { Context } from 'hono'

export { isPublicDemoRead as isViewerRequestAllowed } from '../auth/access-policy.js'

import {
  publicAlert,
  publicDashboardLayout,
  publicGraph,
  publicMetrics,
} from '../modules/share/projections.js'

const DROPPED_KEYS = new Set([
  'attachments',
  'exclusions',
  'description',
  'hostId',
  'identity',
  'ip',
  'mapping',
  'mappingJson',
  'metadata',
  'monitoringError',
  'optionsJson',
  'password',
  'path',
  'secret',
  'shareToken',
  'source',
  'statusMessage',
  'token',
  'url',
  'warnings',
  'webhookSecret',
])

function looksLikeAlert(value: Record<string, unknown>): boolean {
  return (
    typeof value['id'] === 'string' &&
    typeof value['severity'] === 'string' &&
    typeof value['status'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['startTime'] === 'number'
  )
}

function looksLikeGraph(value: Record<string, unknown>): boolean {
  return Array.isArray(value['nodes']) && Array.isArray(value['links'])
}

function looksLikeMetrics(value: Record<string, unknown>): boolean {
  return (
    typeof value['nodes'] === 'object' &&
    !Array.isArray(value['nodes']) &&
    typeof value['links'] === 'object' &&
    !Array.isArray(value['links']) &&
    typeof value['timestamp'] === 'number'
  )
}

/**
 * Defense-in-depth projection for the management-shaped demo reads. Dedicated
 * share projections remain stricter; this removes every known credential and
 * internal-identity carrier before a viewer response leaves the server.
 */
export function publicDemoValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicDemoValue)
  if (!value || typeof value !== 'object') return value

  const object = value as Record<string, unknown>
  if (looksLikeAlert(object)) return publicAlert(object as unknown as Alert)
  if (looksLikeGraph(object)) return publicGraph(object as unknown as NetworkGraph)
  if (looksLikeMetrics(object)) return publicMetrics(object as unknown as MetricsData)

  const projected: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(object)) {
    if (key === 'configJson') {
      projected[key] = '{}'
      continue
    }
    if (key === 'layoutJson' && typeof child === 'string') {
      projected[key] = publicDashboardLayout(child)
      continue
    }
    if (DROPPED_KEYS.has(key)) continue
    projected[key] = publicDemoValue(child)
  }
  return projected
}

export async function projectPublicDemoResponse(c: Context): Promise<void> {
  const contentType = c.res.headers.get('content-type')
  if (!contentType?.includes('application/json') || c.res.status < 200 || c.res.status >= 300)
    return

  const value: unknown = await c.res.clone().json()
  const headers = new Headers(c.res.headers)
  headers.set('Cache-Control', 'no-store')
  c.res = new Response(JSON.stringify(publicDemoValue(value)), {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  })
}
