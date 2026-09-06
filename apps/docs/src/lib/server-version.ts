import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import type { ServerDocsArtifact, ServerGuideArtifact, ServerVersionsModel } from './docs-model'

const markdownProcessor = createMarkdownProcessor()

export interface ServerVersionContext {
  routeVersion: string
  productVersion: string
  channel: ServerDocsArtifact['release']['channel']
  versions: Array<{
    routeVersion: string
    productVersion: string
    channel: ServerDocsArtifact['release']['channel']
  }>
}

export function serverVersionPath(model: ServerVersionsModel, lang: 'en' | 'ja'): string {
  const selected = selectedServerArtifact(model)
  return selected ? `/${lang}/server/${selected.release.version}` : `/${lang}`
}

export function selectedServerArtifact(model: ServerVersionsModel): ServerDocsArtifact | undefined {
  const version = model.aliases.latest ?? model.aliases.beta ?? model.aliases.next
  return model.versions.find((artifact) => artifact.release.version === version)
}

export function versionContext(
  artifact: ServerDocsArtifact,
  model: ServerVersionsModel,
): ServerVersionContext {
  return {
    routeVersion: artifact.release.version,
    productVersion: artifact.release.productVersion,
    channel: artifact.release.channel,
    versions: model.versions.map(({ release }) => ({
      routeVersion: release.version,
      productVersion: release.productVersion,
      channel: release.channel,
    })),
  }
}

export function localizedGuides(
  artifact: ServerDocsArtifact,
  lang: 'en' | 'ja',
): ServerGuideArtifact[] {
  return artifact.guides
    .filter((guide) => guide.locale === lang)
    .sort((left, right) => left.title.localeCompare(right.title))
}

export function guideRouteSlug(guide: ServerGuideArtifact): string {
  return guide.slug.replace(/^server\/?/, '')
}

export function correspondingServerPage(
  pathname: string,
  lang: 'en' | 'ja',
  current: ServerDocsArtifact,
  target: ServerDocsArtifact,
): string {
  const suffix = pathname
    .replace(/\/$/, '')
    .slice(`/${lang}/server/${current.release.version}`.length)
  const base = `/${lang}/server/${target.release.version}`
  if (!suffix) return base
  if (suffix === '/api' || suffix === '/plugins') return `${base}${suffix}`
  const guide = current.guides.find(
    (item) => item.locale === lang && `/guides/${guideRouteSlug(item)}` === suffix,
  )
  if (guide) {
    const match = target.guides.find((item) => item.id === guide.id && item.locale === lang)
    return match ? `${base}/guides/${guideRouteSlug(match)}` : base
  }
  const page = current.pages.find((item) => `/${item.route}` === suffix)
  if (page) {
    const match = target.pages.find((item) => item.id === page.id && item.publication !== 'private')
    return match ? `${base}/${match.route}` : base
  }
  if (
    target.references.api.operations.some((item) => `/api/${item.id}` === suffix) ||
    target.references.plugins.plugins.some((item) => `/plugins/${item.type}` === suffix)
  )
    return `${base}${suffix}`
  return base
}

export function versionedGuideBody(body: string, lang: 'en' | 'ja', version: string): string {
  const base = `/${lang}/server/${version}`
  return body
    .replaceAll(`/${lang}/guides/server`, `${base}/guides`)
    .replaceAll(`/${lang}/reference/server`, `${base}/api`)
    .replaceAll(`/${lang}/reference/plugins`, `${base}/plugins`)
    .replaceAll(`/${lang}/reference/yaml`, `/${lang}/library/yaml`)
}

export async function renderVersionedGuide(
  body: string,
  lang: 'en' | 'ja',
  version: string,
): Promise<string> {
  const processor = await markdownProcessor
  const rendered = await processor.render(versionedGuideBody(body, lang, version))
  return rendered.code
}
