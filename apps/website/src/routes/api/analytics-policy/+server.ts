import { env } from '$env/dynamic/private'
import { analyticsPolicy } from '$lib/analytics/policy'
import type { RequestHandler } from './$types'

export const prerender = false
export const GET: RequestHandler = ({ request }) => {
  const production = env.VERCEL === '1' && env.VERCEL_ENV === 'production'
  const country = production ? request.headers.get('x-vercel-ip-country') : null
  return Response.json(analyticsPolicy(country, production), {
    headers: {
      'cache-control': 'private, no-store',
      'cdn-cache-control': 'no-store',
      'vercel-cdn-cache-control': 'no-store',
      vary: 'x-vercel-ip-country',
    },
  })
}
