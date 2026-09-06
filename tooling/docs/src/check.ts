import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeNetworkLayout, YamlParser } from '@shumoku/core'
import { renderSvgString } from '@shumoku/renderer/static'

interface SourceEntry {
  id: string
  kind: string
  source: string
  inputs?: string[]
  generated: string
}

interface MigrationRoute {
  from: string
  to?: string
  status: 'ready' | 'partial' | 'pending'
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const toolingRoot = path.resolve(toolingDirectory, '..')
const repositoryRoot = path.resolve(toolingRoot, '../..')
const docsDist = path.join(repositoryRoot, 'apps/docs/dist')
const inventoryPath = path.join(toolingRoot, 'docs.sources.json')

async function exists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  )
}

function parseInventory(value: unknown): SourceEntry[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('docs.sources.json must be an object')
  }
  const inventory = value as Record<string, unknown>
  if (inventory['schemaVersion'] !== 1 || !Array.isArray(inventory['sources'])) {
    throw new Error('docs.sources.json has an unsupported schema')
  }
  return inventory['sources'].map((entryValue) => {
    if (typeof entryValue !== 'object' || entryValue === null || Array.isArray(entryValue)) {
      throw new Error('docs.sources.json contains an invalid source')
    }
    const entry = entryValue as Record<string, unknown>
    for (const key of ['id', 'kind', 'source', 'generated']) {
      if (typeof entry[key] !== 'string') throw new Error(`source entry is missing ${key}`)
    }
    if (
      entry['inputs'] !== undefined &&
      (!Array.isArray(entry['inputs']) ||
        !entry['inputs'].every((item) => typeof item === 'string'))
    ) {
      throw new Error('source entry inputs must be strings')
    }
    return entry as unknown as SourceEntry
  })
}

async function digest(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex')
}

async function collectHtml(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectHtml(entryPath)))
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(entryPath)
  }
  return files
}

async function collectFiles(directory: string, suffix: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath, suffix)))
    else if (entry.isFile() && entry.name.endsWith(suffix)) files.push(entryPath)
  }
  return files
}

function parseMigrationRoutes(value: unknown): MigrationRoute[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('migration.routes.json must be an object')
  }
  const document = value as Record<string, unknown>
  if (document['schemaVersion'] !== 1 || !Array.isArray(document['routes'])) {
    throw new Error('migration.routes.json has an unsupported schema')
  }
  return document['routes'].map((routeValue) => {
    if (typeof routeValue !== 'object' || routeValue === null || Array.isArray(routeValue)) {
      throw new Error('migration.routes.json contains an invalid route')
    }
    const route = routeValue as Record<string, unknown>
    if (
      typeof route['from'] !== 'string' ||
      !['ready', 'partial', 'pending'].includes(String(route['status'])) ||
      (route['to'] !== undefined && typeof route['to'] !== 'string')
    ) {
      throw new Error('migration.routes.json contains an invalid route')
    }
    return route as unknown as MigrationRoute
  })
}

async function resolvesInDist(pathname: string): Promise<boolean> {
  const relativePath = pathname.replace(/^\/+|\/+$/g, '')
  const candidates = [
    path.join(docsDist, relativePath),
    path.join(docsDist, `${relativePath}.html`),
    path.join(docsDist, relativePath, 'index.html'),
  ]
  for (const candidate of candidates) {
    if (await exists(candidate)) return true
  }
  return false
}

const inventory = parseInventory(JSON.parse(await readFile(inventoryPath, 'utf8')))
const failures: string[] = []
for (const entry of inventory) {
  for (const [role, relativePath] of [
    ['source', entry.source],
    ['generated', entry.generated],
  ] as const) {
    if (!(await exists(path.join(repositoryRoot, relativePath)))) {
      failures.push(`${entry.id}: missing ${role} ${relativePath}`)
    }
  }
  for (const input of entry.inputs ?? []) {
    if (!(await exists(path.join(repositoryRoot, input)))) {
      failures.push(`${entry.id}: missing input ${input}`)
    }
  }
}

if (failures.length > 0) throw new Error(failures.join('\n'))

const before = new Map<string, string>()
for (const entry of inventory) {
  before.set(entry.generated, await digest(path.join(repositoryRoot, entry.generated)))
}

const generation = spawnSync(process.execPath, ['run', 'generate'], {
  cwd: toolingRoot,
  stdio: 'inherit',
})
if (generation.status !== 0) throw new Error('Second documentation generation failed')

for (const entry of inventory) {
  const after = await digest(path.join(repositoryRoot, entry.generated))
  if (before.get(entry.generated) !== after) {
    failures.push(`${entry.id}: generation is not deterministic (${entry.generated})`)
  }
}

const examplePath = path.join(repositoryRoot, 'examples/getting-started.yaml')
const exampleResult = new YamlParser().parse(await readFile(examplePath, 'utf8'))
const exampleErrors = exampleResult.warnings?.filter(({ severity }) => severity === 'error') ?? []
if (exampleErrors.length > 0) {
  failures.push(
    `getting-started example failed to parse: ${exampleErrors.map(({ message }) => message).join('; ')}`,
  )
} else {
  const { resolved } = await computeNetworkLayout(exampleResult.graph)
  const svg = renderSvgString(resolved)
  if (!svg.startsWith('<svg') || !svg.includes('data-id="router"')) {
    failures.push('getting-started example did not render the expected SVG')
  }
}

const htmlFiles = await collectHtml(docsDist)
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8')
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1]
    if (!href || href.startsWith('#')) continue
    const url = new URL(href, 'https://docs.shumoku.dev')
    if (url.origin !== 'https://docs.shumoku.dev') continue
    if (!(await resolvesInDist(decodeURIComponent(url.pathname)))) {
      failures.push(
        `${path.relative(repositoryRoot, htmlFile)}: unresolved internal link ${url.pathname}`,
      )
    }
  }
}

const migrationPath = path.join(toolingRoot, 'migration.routes.json')
const migrationRoutes = parseMigrationRoutes(JSON.parse(await readFile(migrationPath, 'utf8')))
const routeBySource = new Map(migrationRoutes.map((route) => [route.from, route]))
if (routeBySource.size !== migrationRoutes.length) {
  failures.push('migration.routes.json contains duplicate legacy routes')
}

const legacyCollection = spawnSync('node', [path.join(toolingRoot, 'scripts/collect-legacy.mjs')], {
  encoding: 'utf8',
})
if (legacyCollection.status !== 0)
  throw new Error(legacyCollection.stderr || 'Legacy inventory collection failed')
const legacyRoot = path.join(toolingRoot, 'legacy-content')
const legacyEnglishFiles = await collectFiles(legacyRoot, '.en.mdx')
const legacyRoutes = legacyEnglishFiles.map((file) => {
  const relative = path.relative(legacyRoot, file).replace(/\.en\.mdx$/, '')
  return `/docs/${relative.replace(/\/index$/, '')}`
})
for (const legacyRoute of legacyRoutes) {
  if (!routeBySource.has(legacyRoute))
    failures.push(`migration inventory is missing ${legacyRoute}`)
}
for (const route of migrationRoutes) {
  if (!legacyRoutes.includes(route.from))
    failures.push(`migration inventory has unknown route ${route.from}`)
  if (route.status === 'ready') {
    if (!route.to) failures.push(`${route.from}: ready migration has no destination`)
    else if (!(await resolvesInDist(route.to))) {
      failures.push(`${route.from}: migration destination does not exist (${route.to})`)
    }
  }
}

if (failures.length > 0) throw new Error(failures.join('\n'))
console.log(
  `[docs] check passed (${inventory.length} sources, ${htmlFiles.length} pages, ${migrationRoutes.length} legacy routes inventoried, executable example, deterministic generation, internal links)`,
)
