import { websiteOrigin } from '$lib/site'
export const prerender = true
export const GET = () =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${websiteOrigin}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  )
