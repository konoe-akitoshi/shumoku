import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware'
import { i18n } from '@/lib/i18n'

export default createI18nMiddleware(i18n)

export const config = {
  // Exclude static files and API routes from i18n middleware
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:svg|png|ico|jpg|jpeg|gif|webp|mp4|webm)$|og).*)'],
}
