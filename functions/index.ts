// Cloudflare Pages project root is the repository root. Only / invokes this function.
import { languageRedirect } from '../tooling/site-i18n/index'
export const onRequest = ({ request }: { request: Request }) =>
  request.method === 'GET' || request.method === 'HEAD'
    ? languageRedirect(request)
    : new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
