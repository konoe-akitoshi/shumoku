import migration from '../../../../tooling/docs/migration.routes.json'
import { docsOrigin, docsUrl, editorOrigin, type Locale } from './site'

// Last published source snapshot before moving the archive. Works in previews
// as well as after main removes the old paths, without depending on this PR merging.
const archiveRevision = '6449525797209587ee7eb23353dfef2606082b12'
const archiveBase = `https://github.com/konoe-akitoshi/shumoku/blob/${archiveRevision}/apps/website/content/docs`

/** Only reviewed mappings go to current Docs; unported articles remain accessible as source. */
export function legacyDestination(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path.startsWith('/llms.mdx/docs/')) {
    return markdownDestination(`/docs/${path.slice('/llms.mdx/docs/'.length)}`)
  }
  if (/\/docs\/.*\.mdx$/.test(path)) return markdownDestination(path.slice(0, -4))
  const locale: Locale = path.startsWith('/ja/') || path === '/ja' ? 'ja' : 'en'
  const local = path.replace(/^\/(en|ja)(?=\/|$)/, '')
  if (local === '/editor') return editorOrigin
  if (path === '/playground') return '/en/playground'
  if (local === '/og' || path.startsWith('/og/docs/')) return '/screenshots/topology.png'
  if (path === '/icon.svg') return '/logo-symbol.svg'
  if (path === '/llms-full.txt') return `${docsOrigin}/llms.txt`
  if (local === '/docs') return docsUrl(locale)
  const route = migration.routes.find((entry) => entry.from === local)
  if (!route) return null
  if (route.status === 'ready' && 'to' in route && route.to) {
    return `${docsOrigin}${route.to.replace(/^\/en(?=\/|$)/, `/${locale}`)}`
  }
  const article = local.slice('/docs/'.length)
  const file = article === 'npm' || article === 'npm/netbox' ? `${article}/index` : article
  return `${archiveBase}/${file}.${locale}.mdx`
}

function markdownDestination(path: string): string | null {
  const destination = legacyDestination(path)
  if (destination?.startsWith(`${docsOrigin}/`)) return `${destination}.md`
  return (
    destination?.replace(
      `https://github.com/konoe-akitoshi/shumoku/blob/${archiveRevision}/`,
      `https://raw.githubusercontent.com/konoe-akitoshi/shumoku/${archiveRevision}/`,
    ) ?? null
  )
}
