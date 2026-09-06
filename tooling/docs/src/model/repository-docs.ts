import path from 'node:path'
// Repository source resolution is independent of the Astro application.
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import type { RepositoryDocumentSource, RepositoryPage } from './docs-model'

const markdownProcessor = createMarkdownProcessor()
const repositoryUrl = 'https://github.com/konoe-akitoshi/shumoku'
const rawRepositoryUrl = 'https://raw.githubusercontent.com/konoe-akitoshi/shumoku'

export function repositoryPagePath(
  page: RepositoryPage,
  lang: 'en' | 'ja',
  serverVersion?: string,
): string {
  if (page.owner === 'project') return `/${lang}/${page.route}`
  const base =
    page.owner === 'server' && serverVersion
      ? `/${lang}/server/${serverVersion}`
      : `/${lang}/${page.owner}`
  return page.route === 'overview' ? base : `${base}/${page.route}`
}

function localizedSource(page: RepositoryPage, lang: 'en' | 'ja'): RepositoryDocumentSource {
  const source =
    page.sources[lang] ?? page.sources[page.canonicalLocale] ?? Object.values(page.sources)[0]
  if (!source) throw new Error(`Repository page ${page.id} has no source`)
  return source
}

export function localizedPage(page: RepositoryPage, lang: 'en' | 'ja') {
  const source = localizedSource(page, lang)
  return {
    source,
    title: page.title[lang] ?? page.title[page.canonicalLocale] ?? page.id,
    description: page.description[lang] ?? page.description[page.canonicalLocale] ?? '',
    fallback: source.locale !== lang,
  }
}

function registeredSources(pages: RepositoryPage[]): Map<string, RepositoryPage> {
  const sources = new Map<string, RepositoryPage>()
  for (const page of pages) {
    if (page.publication === 'private') continue
    for (const source of Object.values(page.sources)) {
      sources.set(source.file, page)
      if (path.posix.basename(source.file) === 'README.md') {
        sources.set(path.posix.dirname(source.file), page)
      }
    }
  }
  return sources
}

function splitTarget(target: string): { pathname: string; suffix: string } {
  const boundary = target.search(/[?#]/)
  return boundary === -1
    ? { pathname: target, suffix: '' }
    : { pathname: target.slice(0, boundary), suffix: target.slice(boundary) }
}

function rewriteTarget(
  target: string,
  source: RepositoryDocumentSource,
  pages: RepositoryPage[],
  lang: 'en' | 'ja',
  sourceRef: string,
  serverVersion?: string,
  image = false,
): string {
  if (
    target === '' ||
    target.startsWith('#') ||
    target.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  ) {
    return target
  }

  const { pathname, suffix } = splitTarget(target)
  const sourcePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(source.file), pathname),
  )
  if (image) return `${rawRepositoryUrl}/${sourceRef}/${sourcePath}${suffix}`

  const registered = registeredSources(pages).get(sourcePath.replace(/\/$/, ''))
  if (registered) {
    const version = registered.owner === 'server' ? serverVersion : undefined
    return `${repositoryPagePath(registered, lang, version)}${suffix}`
  }
  return `${repositoryUrl}/blob/${sourceRef}/${sourcePath}${suffix}`
}

export async function renderRepositoryPage(
  page: RepositoryPage,
  pages: RepositoryPage[],
  lang: 'en' | 'ja',
  sourceRef: string,
  options: { serverVersion?: string; stripTitle?: boolean } = {},
): Promise<string> {
  const source = localizedSource(page, lang)
  let body = source.body
  if (options.stripTitle) body = body.replace(/^#\s+[^\n]+\n+/, '')

  body = body.replace(
    /(\[!\[[^\]]*\]\([^)]+\)\])\(([^\s)]+)([^)]*)\)/g,
    (_match, imageLink, target, rest) => {
      const rewritten = rewriteTarget(target, source, pages, lang, sourceRef, options.serverVersion)
      return `${imageLink}(${rewritten}${rest})`
    },
  )
  body = body.replace(
    /(!?)\[([^\]]*)\]\(([^\s)]+)([^)]*)\)/g,
    (_match, marker, label, target, rest) => {
      const rewritten = rewriteTarget(
        target,
        source,
        pages,
        lang,
        sourceRef,
        options.serverVersion,
        marker === '!',
      )
      return `${marker}[${label}](${rewritten}${rest})`
    },
  )
  body = body.replace(/\b(href|src)="([^"]+)"/g, (_match, attribute, target) => {
    const rewritten = rewriteTarget(
      target,
      source,
      pages,
      lang,
      sourceRef,
      options.serverVersion,
      attribute === 'src',
    )
    return `${attribute}="${rewritten}"`
  })

  const processor = await markdownProcessor
  return (await processor.render(body)).code
}
