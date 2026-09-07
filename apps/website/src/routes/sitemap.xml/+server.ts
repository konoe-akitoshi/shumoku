import { locales, websiteOrigin } from '$lib/site'
export const prerender = true
export const GET = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locales.flatMap((locale) => ['', '/playground'].map((suffix) => `<url><loc>${websiteOrigin}/${locale}${suffix}</loc></url>`)).join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  )
