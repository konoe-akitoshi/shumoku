import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArtifact } from './sync-server-versions'

type JsonRecord = Record<string, unknown>

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const modelPath = path.join(repositoryRoot, 'apps/docs/.generated/server-versions.json')
const docsDist = path.join(repositoryRoot, 'apps/docs/dist')

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value as JsonRecord).flatMap(collectStrings)
}

async function exists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  )
}

const value: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
if (typeof value !== 'object' || value === null || Array.isArray(value)) {
  throw new Error('server-versions.json must be an object')
}
const model = value as JsonRecord
if (model['schemaVersion'] !== 1 || !Array.isArray(model['versions'])) {
  throw new Error('server-versions.json has an unsupported schema')
}
const aliases = model['aliases']
if (typeof aliases !== 'object' || aliases === null || Array.isArray(aliases)) {
  throw new Error('server-versions.json has invalid aliases')
}
const aliasRecord = aliases as JsonRecord
const artifacts = model['versions'].map((artifact, index) =>
  parseArtifact(artifact, `server-versions.json versions[${index}]`),
)
const byVersion = new Map(artifacts.map((artifact) => [artifact.release.version, artifact]))

for (const [alias, expectedChannel] of [
  ['latest', 'stable'],
  ['beta', 'beta'],
  ['next', 'development'],
] as const) {
  const version = aliasRecord[alias]
  if (version === undefined) continue
  if (typeof version !== 'string') throw new Error(`${alias} alias must be a string`)
  const artifact = byVersion.get(version)
  if (!artifact) throw new Error(`${alias} alias points to missing Server docs ${version}`)
  if (artifact.release.channel !== expectedChannel) {
    throw new Error(
      `${alias} alias points to ${artifact.release.channel}, expected ${expectedChannel}`,
    )
  }
}

for (const artifact of artifacts) {
  const { version, channel, tag } = artifact.release
  if (channel === 'development') {
    if (version !== 'next' || tag !== null) throw new Error('development docs must use next')
  } else if (tag !== `server-v${version}`) {
    throw new Error(`${version}: tag and version do not match`)
  }
  if (collectStrings(artifact).some((item) => item.includes('/blob/main/'))) {
    throw new Error(`${version}: source links must use an immutable tag or commit`)
  }
  for (const lang of ['en', 'ja']) {
    const landing = path.join(docsDist, lang, 'server', `${version}.html`)
    if (!(await exists(landing))) throw new Error(`${version}: missing ${lang} Server landing`)
    const html = await readFile(landing, 'utf8')
    if (!html.includes(`server-version:${version}`)) {
      throw new Error(`${version}: ${lang} page has no scoped Pagefind filter`)
    }
    const expectedSearchScope =
      version === aliasRecord['latest'] ||
      (!aliasRecord['latest'] && version === aliasRecord['beta'])
        ? 'default'
        : channel === 'stable'
          ? 'archive'
          : 'prerelease'
    if (!html.includes(`search-scope:${expectedSearchScope}`)) {
      throw new Error(`${version}: ${lang} page has the wrong Pagefind search scope`)
    }
  }
}

for (const lang of ['en', 'ja']) {
  const entryPath = path.join(docsDist, lang, 'server.html')
  if (!(await exists(entryPath))) throw new Error(`Server: missing ${lang} product entry`)
}

if (aliasRecord['beta']) {
  for (const lang of ['en', 'ja']) {
    const aliasPath = path.join(docsDist, lang, 'server', 'beta.html')
    if (!(await exists(aliasPath))) throw new Error(`beta: missing ${lang} alias page`)
  }
}

console.log(
  `[docs] Server versions check passed (${artifacts.length} artifacts; aliases ${Object.keys(aliasRecord).join(', ') || 'none'})`,
)
