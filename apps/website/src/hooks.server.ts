import type { Handle } from '@sveltejs/kit'
import { legacyDestination } from '$lib/legacy'

export const handle: Handle = async ({ event, resolve }) => {
  if (event.request.method === 'GET' || event.request.method === 'HEAD') {
    const destination = legacyDestination(event.url.pathname)
    if (destination) return new Response(null, { status: 307, headers: { location: destination } })
  }
  if (event.url.pathname === '/api/search') {
    return Response.json(
      { error: 'Search has moved to Docs', url: 'https://docs.shumoku.dev' },
      { status: 410 },
    )
  }
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace(
        '<html lang="en">',
        `<html lang="${event.params['lang'] === 'ja' ? 'ja' : 'en'}">`,
      ),
  })
}
