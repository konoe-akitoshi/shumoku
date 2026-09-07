import { languageRedirect } from '@shumoku/site-i18n'
import type { RequestHandler } from './$types'

export const prerender = false
export const GET: RequestHandler = ({ request }) => languageRedirect(request)
export const HEAD = GET
