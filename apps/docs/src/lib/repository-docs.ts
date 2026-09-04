import path from 'node:path'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import type { RepositoryDocument } from './docs-model'

const markdownProcessor = createMarkdownProcessor()
const repositoryUrl = 'https://github.com/konoe-akitoshi/shumoku'
const rawRepositoryUrl = 'https://raw.githubusercontent.com/konoe-akitoshi/shumoku'

export function repositoryDocumentPath(
  document: RepositoryDocument,
  lang: 'en' | 'ja',
  serverVersion?: string,
): string {
  if (document.owner === 'project') {
    return document.route === 'overview' ? `/${lang}` : `/${lang}/${document.route}`
  }
  const base =
    document.owner === 'server' && serverVersion
      ? `/${lang}/server/${serverVersion}`
      : `/${lang}/${document.owner}`
  return document.route === 'overview' ? base : `${base}/${document.route}`
}

function registeredSources(documents: RepositoryDocument[]): Map<string, RepositoryDocument> {
  const sources = new Map<string, RepositoryDocument>()
  for (const document of documents) {
    sources.set(document.file, document)
    if (path.posix.basename(document.file) === 'README.md') {
      sources.set(path.posix.dirname(document.file), document)
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
  document: RepositoryDocument,
  documents: RepositoryDocument[],
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
    path.posix.join(path.posix.dirname(document.file), pathname),
  )
  if (image) return `${rawRepositoryUrl}/${sourceRef}/${sourcePath}${suffix}`

  const registered = registeredSources(documents).get(sourcePath.replace(/\/$/, ''))
  if (registered) {
    const version = registered.owner === 'server' ? serverVersion : undefined
    return `${repositoryDocumentPath(registered, lang, version)}${suffix}`
  }
  return `${repositoryUrl}/blob/${sourceRef}/${sourcePath}${suffix}`
}

export async function renderRepositoryDocument(
  document: RepositoryDocument,
  documents: RepositoryDocument[],
  lang: 'en' | 'ja',
  sourceRef: string,
  options: { serverVersion?: string; stripTitle?: boolean } = {},
): Promise<string> {
  let body = document.body
  if (options.stripTitle) body = body.replace(/^#\s+[^\n]+\n+/, '')

  body = body.replace(
    /(\[!\[[^\]]*\]\([^)]+\)\])\(([^\s)]+)([^)]*)\)/g,
    (_match, imageLink, target, rest) => {
      const rewritten = rewriteTarget(
        target,
        document,
        documents,
        lang,
        sourceRef,
        options.serverVersion,
      )
      return `${imageLink}(${rewritten}${rest})`
    },
  )
  body = body.replace(
    /(!?)\[([^\]]*)\]\(([^\s)]+)([^)]*)\)/g,
    (_match, marker, label, target, rest) => {
      const rewritten = rewriteTarget(
        target,
        document,
        documents,
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
      document,
      documents,
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
