import type { APIRoute } from 'astro'

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      id: '/',
      name: 'Shumoku Docs',
      short_name: 'Shumoku Docs',
      start_url: '/',
      scope: '/',
      display: 'browser',
      icons: [192, 512].map((size) => ({
        src: `/web-app-manifest-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
      })),
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
