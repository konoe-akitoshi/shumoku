import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RepositoryDocsModel, ServerDocsArtifact } from '../../../apps/docs/src/lib/docs-model'
import { docsNavigation } from '../../../apps/docs/src/lib/navigation'

type Channel = 'development' | 'beta' | 'stable'
type JsonRecord = Record<string, unknown>

interface GeneratedGuide extends JsonRecord {
  file: string
  locale: 'en' | 'ja'
  slug: string
}

interface RepositoryPage extends JsonRecord {
  owner: string
  route: string
  sources: Record<string, { file: string }>
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const generatedRoot = path.join(repositoryRoot, 'apps/docs/.generated')
const outputPath =
  process.env['SHUMOKU_DOCS_ARTIFACT_OUTPUT'] ?? path.join(generatedRoot, 'server-artifact.json')

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(filePath: string): Promise<JsonRecord> {
  const value: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${filePath} must contain a JSON object`)
  }
  return value as JsonRecord
}

function currentCommit(): string {
  const configured = process.env['SHUMOKU_DOCS_COMMIT']?.trim()
  if (configured) return configured
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error('Unable to resolve the docs source commit')
  return result.stdout.trim()
}

function withSourceRef<T>(value: T, sourceRef: string): T {
  return JSON.parse(JSON.stringify(value).replaceAll('/blob/main/', `/blob/${sourceRef}/`)) as T
}

function guideBody(contents: string, file: string): string {
  const match = contents.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  const body = match?.[1]
  if (body === undefined) throw new Error(`${file}: invalid guide frontmatter`)
  return body
}

const packagePath = path.join(repositoryRoot, 'apps/server/package.json')
const packageManifest = await readJson(packagePath)
const productVersion = packageManifest['version']
if (typeof productVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(productVersion)) {
  throw new Error('apps/server/package.json contains an invalid Server version')
}

const releaseMode = process.env['SHUMOKU_DOCS_RELEASE'] === 'true'
const expectedChannel: Channel = productVersion.includes('-beta.') ? 'beta' : 'stable'
const channel: Channel = releaseMode ? expectedChannel : 'development'
const version = releaseMode ? productVersion : 'next'
const tag = releaseMode ? `server-v${productVersion}` : null
const configuredChannel = process.env['SHUMOKU_DOCS_CHANNEL']
const configuredTag = process.env['SHUMOKU_DOCS_TAG']
if (configuredChannel && configuredChannel !== channel) {
  throw new Error(`Server docs channel ${configuredChannel} does not match ${channel}`)
}
if (configuredTag && configuredTag !== tag) {
  throw new Error(`Server docs tag ${configuredTag} does not match ${tag}`)
}

const commit = currentCommit()
const sourceRef = tag ?? commit
const serverPath = path.join(generatedRoot, 'server.json')
const pluginsPath = path.join(generatedRoot, 'plugins.json')
const guidesPath = path.join(generatedRoot, 'guides.json')
const repositoryDocsPath = path.join(generatedRoot, 'repository-docs.json')
const server = await readJson(serverPath)
const plugins = await readJson(pluginsPath)
const guideModel = await readJson(guidesPath)
const repositoryDocsModel = await readJson(repositoryDocsPath)
if (!Array.isArray(guideModel['guides'])) throw new Error('guides.json has no guides array')
if (!Array.isArray(repositoryDocsModel['pages'])) {
  throw new Error('repository-docs.json has no pages array')
}

const inputDigests: Record<string, string> = {}
for (const filePath of [packagePath, serverPath, pluginsPath, guidesPath, repositoryDocsPath]) {
  inputDigests[path.relative(repositoryRoot, filePath)] = sha256(await readFile(filePath))
}

const guides = []
for (const value of guideModel['guides']) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
  const guide = value as GeneratedGuide
  if (
    typeof guide.file !== 'string' ||
    (guide.locale !== 'en' && guide.locale !== 'ja') ||
    typeof guide.slug !== 'string' ||
    !guide.slug.startsWith('server/')
  ) {
    continue
  }
  const sourcePath = path.join(repositoryRoot, guide.file)
  const contents = await readFile(sourcePath, 'utf8')
  inputDigests[guide.file] = sha256(contents)
  guides.push({ ...guide, body: guideBody(contents, guide.file) })
}
guides.sort((left, right) =>
  `${left.locale}/${left.slug}`.localeCompare(`${right.locale}/${right.slug}`),
)

const pages = repositoryDocsModel['pages']
  .filter((value): value is RepositoryPage => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const document = value as JsonRecord
    return (
      document['owner'] === 'server' &&
      typeof document['route'] === 'string' &&
      typeof document['sources'] === 'object' &&
      document['sources'] !== null
    )
  })
  .sort((left, right) => left.route.localeCompare(right.route))

const content = withSourceRef(
  {
    schemaVersion: 2,
    product: 'server',
    release: {
      version,
      productVersion,
      channel,
      tag,
      sourceCommit: commit,
    },
    references: {
      api: {
        ...server,
        api: {
          ...((server['api'] as JsonRecord | undefined) ?? {}),
          version: productVersion,
        },
      },
      plugins,
    },
    guides,
    pages,
  },
  sourceRef,
)
const snapshot = content as unknown as ServerDocsArtifact
const navigation = Object.fromEntries(
  (['en', 'ja'] as const).map((lang) => {
    const base = `/${lang}/server/${version}`
    const groups = docsNavigation(
      base,
      lang,
      { pages: [] } as unknown as RepositoryDocsModel,
      snapshot,
    )
    const linked = new Set(groups.flatMap(({ links }) => links.map(({ href }) => href)))
    const extra = [
      ...snapshot.guides
        .filter((guide) => guide.locale === lang && guide.id !== 'server.overview')
        .map((guide) => ({
          label: guide.title,
          href: `${base}/guides/${guide.slug.replace(/^server\//, '')}`,
        })),
      ...snapshot.pages
        .filter((page) => page.publication === 'public' && page.route !== 'overview')
        .map((page) => ({
          label: page.title[lang] ?? page.title[page.canonicalLocale] ?? page.id,
          href: `${base}/${page.route}`,
        })),
    ].filter(({ href }) => !linked.has(href))
    if (extra.length)
      groups.push({
        label: lang === 'ja' ? 'その他のドキュメント' : 'More documentation',
        links: extra,
      })
    return [lang, groups]
  }),
)
const versionedContent = { ...content, navigation }
const integrity = {
  algorithm: 'sha256',
  inputs: Object.fromEntries(
    Object.entries(inputDigests).sort(([left], [right]) => left.localeCompare(right)),
  ),
  contentDigest: sha256(JSON.stringify(versionedContent)),
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ ...versionedContent, integrity }, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${version}, ${guides.length} localized Server guides)`,
)
