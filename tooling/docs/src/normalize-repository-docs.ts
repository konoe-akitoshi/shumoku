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
  title: string
  description: string
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
    return {
      id: requiredString(document, 'id', context),
      source: requiredString(document, 'source', context),
      route: requiredString(document, 'route', context).replace(/^\/+|\/+$/g, ''),
      locale: locale as Locale,
      title: requiredString(document, 'title', context),
      description: requiredString(document, 'description', context),
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

const documents = []
const ids = new Set<string>()
const routes = new Set<string>()
for (const manifestPath of (await collectManifests(repositoryRoot)).sort()) {
  const manifestFile = path.relative(repositoryRoot, manifestPath)
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')), manifestFile)
  const ownerDirectory = path.dirname(manifestPath)

  for (const document of manifest.documents) {
    if (ids.has(document.id)) throw new Error(`${manifestFile}: duplicate id ${document.id}`)
    const routeKey = `${manifest.owner}/${document.route}`
    if (routes.has(routeKey)) throw new Error(`${manifestFile}: duplicate route ${routeKey}`)

    const sourcePath = path.resolve(ownerDirectory, document.source)
    const relativeSource = path.relative(repositoryRoot, sourcePath)
    if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) {
      throw new Error(`${manifestFile}: source escapes the repository: ${document.source}`)
    }
    const body = await readFile(sourcePath, 'utf8')
    ids.add(document.id)
    routes.add(routeKey)
    documents.push({
      ...document,
      owner: manifest.owner,
      file: relativeSource,
      manifest: manifestFile,
      body,
    })
  }
}

documents.sort((left, right) => left.id.localeCompare(right.id))
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      sourceCommit: currentCommit(),
      documents,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${documents.length} repository documents)`,
)
