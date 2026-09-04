import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface SourceEntry {
  id: string
  kind: string
  source: string
  generated: string
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

async function resolvesInDist(pathname: string): Promise<boolean> {
  const relativePath = pathname.replace(/^\/+/, '')
  const candidates = pathname.endsWith('/')
    ? [path.join(docsDist, relativePath, 'index.html')]
    : [
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

if (failures.length > 0) throw new Error(failures.join('\n'))
console.log(
  `[docs] check passed (${inventory.length} sources, ${htmlFiles.length} pages, deterministic generation, internal links)`,
)
