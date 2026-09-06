// Ensure legacy paths reach the compatibility hook in Vercel's generated routing.
// Unknown paths remain 404s; there is no SPA fallback or blanket homepage redirect.
export const GET = () => new Response('Not found', { status: 404 })
