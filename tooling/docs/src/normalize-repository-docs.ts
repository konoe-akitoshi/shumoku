import { spawnSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Locale = 'en' | 'ja'
type Owner = 'project' | 'library' | 'cli' | 'server'

interface ManifestDocument {
  id: string
  source: string
  route: string
  locale: Locale
  canonicalLocale?: Locale
  title: string
  description: string
  kind?: 'overview' | 'guide' | 'reference' | 'policy'
  audience?: 'user' | 'developer' | 'maintainer'
  publication?: 'public' | 'unlisted' | 'private'
  searchable?: boolean
}

interface DocsManifest {
  schemaVersion: 1
  owner: Owner
  documents: ManifestDocument[]
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const outputPath = path.join(repositoryRoot, 'apps/docs/.generated/repository-docs.json')
const excludedDirectories = new Set([
  '.astro',
  '.generated',
  '.git',
  '.turbo',
  'dist',
  'node_modules',
])

async function collectManifests(directory: string): Promise<string[]> {
  const manifests: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) manifests.push(...(await collectManifests(entryPath)))
    else if (entry.isFile() && entry.name === 'docs.manifest.json') manifests.push(entryPath)
  }
  return manifests
}

function requiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context}: ${key} must be a non-empty string`)
  }
  return value
}

function parseManifest(value: unknown, file: string): DocsManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${file}: manifest must be an object`)
  }
  const record = value as Record<string, unknown>
  const owner = record['owner']
  if (
    record['schemaVersion'] !== 1 ||
    !['project', 'library', 'cli', 'server'].includes(String(owner)) ||
    !Array.isArray(record['documents'])
  ) {
    throw new Error(`${file}: unsupported manifest schema`)
  }

  const documents = record['documents'].map((documentValue, index) => {
    const context = `${file}: documents[${index}]`
    if (
      typeof documentValue !== 'object' ||
      documentValue === null ||
      Array.isArray(documentValue)
    ) {
      throw new Error(`${context} must be an object`)
    }
    const document = documentValue as Record<string, unknown>
    const locale = document['locale']
    if (locale !== 'en' && locale !== 'ja') {
      throw new Error(`${context}: locale must be en or ja`)
    }
    if (
      document['canonicalLocale'] !== undefined &&
      document['canonicalLocale'] !== 'en' &&
      document['canonicalLocale'] !== 'ja'
    ) {
      throw new Error(`${context}: canonicalLocale must be en or ja`)
    }
    if (
      document['kind'] !== undefined &&
      !['overview', 'guide', 'reference', 'policy'].includes(String(document['kind']))
    ) {
      throw new Error(`${context}: kind is invalid`)
    }
    if (
      document['audience'] !== undefined &&
      !['user', 'developer', 'maintainer'].includes(String(document['audience']))
    ) {
      throw new Error(`${context}: audience is invalid`)
    }
    if (
      document['publication'] !== undefined &&
      !['public', 'unlisted', 'private'].includes(String(document['publication']))
    ) {
      throw new Error(`${context}: publication is invalid`)
    }
    if (document['searchable'] !== undefined && typeof document['searchable'] !== 'boolean') {
      throw new Error(`${context}: searchable must be boolean`)
    }
    return {
      id: requiredString(document, 'id', context),
      source: requiredString(document, 'source', context),
      route: requiredString(document, 'route', context).replace(/^\/+|\/+$/g, ''),
      locale: locale as Locale,
      ...(document['canonicalLocale'] === 'en' || document['canonicalLocale'] === 'ja'
        ? { canonicalLocale: document['canonicalLocale'] as Locale }
        : {}),
      title: requiredString(document, 'title', context),
      description: requiredString(document, 'description', context),
      ...(['overview', 'guide', 'reference', 'policy'].includes(String(document['kind']))
        ? { kind: document['kind'] as ManifestDocument['kind'] }
        : {}),
      ...(['user', 'developer', 'maintainer'].includes(String(document['audience']))
        ? { audience: document['audience'] as ManifestDocument['audience'] }
        : {}),
      ...(['public', 'unlisted', 'private'].includes(String(document['publication']))
        ? { publication: document['publication'] as ManifestDocument['publication'] }
        : {}),
      ...(typeof document['searchable'] === 'boolean'
        ? { searchable: document['searchable'] }
        : {}),
    }
  })

  return { schemaVersion: 1, owner: owner as Owner, documents }
}

function currentCommit(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error('Unable to resolve the documentation source commit')
  return result.stdout.trim()
}

const pages = new Map<
  string,
  {
    id: string
    owner: Owner
    route: string
    kind: 'overview' | 'guide' | 'reference' | 'policy'
    audience: 'user' | 'developer' | 'maintainer'
    publication: 'public' | 'unlisted' | 'private'
    searchable: boolean
    canonicalLocale: Locale
    title: Partial<Record<Locale, string>>
    description: Partial<Record<Locale, string>>
    sources: Partial<
      Record<Locale, { locale: Locale; file: string; manifest: string; body: string }>
    >
  }
>()
const routes = new Set<string>()
for (const manifestPath of (await collectManifests(repositoryRoot)).sort()) {
  const manifestFile = path.relative(repositoryRoot, manifestPath)
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')), manifestFile)
  const ownerDirectory = path.dirname(manifestPath)

  for (const document of manifest.documents) {
    const routeKey = `${manifest.owner}/${document.route}`
    const existing = pages.get(document.id)
    if (routes.has(routeKey) && !existing) {
      throw new Error(`${manifestFile}: duplicate route ${routeKey}`)
    }
    if (existing && (existing.owner !== manifest.owner || existing.route !== document.route)) {
      throw new Error(`${manifestFile}: localized page ${document.id} must keep owner and route`)
    }

    const sourcePath = path.resolve(ownerDirectory, document.source)
    const relativeSource = path.relative(repositoryRoot, sourcePath)
    if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) {
      throw new Error(`${manifestFile}: source escapes the repository: ${document.source}`)
    }
    const body = await readFile(sourcePath, 'utf8')
    const metadata = {
      kind: document.kind ?? (document.route === 'overview' ? 'overview' : 'guide'),
      audience: document.audience ?? 'user',
      publication: document.publication ?? 'public',
      searchable: document.searchable ?? document.publication !== 'private',
      canonicalLocale: document.canonicalLocale ?? document.locale,
    }
    if (
      existing &&
      (existing.kind !== metadata.kind ||
        existing.audience !== metadata.audience ||
        existing.publication !== metadata.publication ||
        existing.searchable !== metadata.searchable ||
        existing.canonicalLocale !== metadata.canonicalLocale)
    ) {
      throw new Error(`${manifestFile}: localized page ${document.id} has inconsistent metadata`)
    }
    const page = existing ?? {
      id: document.id,
      owner: manifest.owner,
      route: document.route,
      ...metadata,
      title: {},
      description: {},
      sources: {},
    }
    if (page.sources[document.locale]) {
      throw new Error(`${manifestFile}: duplicate ${document.locale} source for ${document.id}`)
    }
    page.title[document.locale] = document.title
    page.description[document.locale] = document.description
    page.sources[document.locale] = {
      locale: document.locale,
      file: relativeSource,
      manifest: manifestFile,
      body,
    }
    pages.set(document.id, page)
    routes.add(routeKey)
  }
}

const documents = [...pages.values()].sort((left, right) => left.id.localeCompare(right.id))
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 2,
      sourceCommit: currentCommit(),
      pages: documents,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${documents.length} repository pages)`,
)
