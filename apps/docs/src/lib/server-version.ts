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

export function serverEntryPath(model: ServerVersionsModel, lang: 'en' | 'ja'): string {
  return selectedServerArtifact(model) ? `/${lang}/server` : `/${lang}`
}

export function serverVersionPath(model: ServerVersionsModel, lang: 'en' | 'ja'): string {
  const selected = selectedServerArtifact(model)
  return selected ? `/${lang}/server/${selected.release.version}` : `/${lang}`
}

export function selectedServerArtifact(model: ServerVersionsModel): ServerDocsArtifact | undefined {
  const version = model.aliases.latest ?? model.aliases.next ?? model.aliases.beta
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
