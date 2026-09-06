import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Channel = 'development' | 'beta' | 'stable'
type JsonRecord = Record<string, unknown>

export interface ServerDocsArtifact extends JsonRecord {
  schemaVersion: 2
  product: 'server'
  release: {
    version: string
    productVersion: string
    channel: Channel
    tag: string | null
    sourceCommit: string
  }
  integrity: {
    algorithm: 'sha256'
    inputs: Record<string, string>
    contentDigest: string
  }
}

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  prerelease: boolean
  draft: boolean
  assets: GitHubAsset[]
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const generatedRoot = path.join(repositoryRoot, 'apps/docs/.generated')
const defaultArtifact = path.join(generatedRoot, 'server-artifact.json')
const outputPath = path.join(generatedRoot, 'server-versions.json')

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function artifactContent(value: JsonRecord): JsonRecord {
  const { integrity: _integrity, ...content } = value
  return content
}

export function parseArtifact(value: unknown, context: string): ServerDocsArtifact {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context}: artifact must be an object`)
  }
  const artifact = value as JsonRecord
  const release = artifact['release']
  const integrity = artifact['integrity']
  if (
    ![1, 2].includes(Number(artifact['schemaVersion'])) ||
    artifact['product'] !== 'server' ||
    typeof release !== 'object' ||
    release === null ||
    Array.isArray(release) ||
    typeof integrity !== 'object' ||
    integrity === null ||
    Array.isArray(integrity)
  ) {
    throw new Error(`${context}: unsupported Server docs artifact`)
  }
  const releaseRecord = release as JsonRecord
  const integrityRecord = integrity as JsonRecord
  if (
    typeof releaseRecord['version'] !== 'string' ||
    typeof releaseRecord['productVersion'] !== 'string' ||
    !['development', 'beta', 'stable'].includes(String(releaseRecord['channel'])) ||
    integrityRecord['algorithm'] !== 'sha256' ||
    typeof integrityRecord['contentDigest'] !== 'string'
  ) {
    throw new Error(`${context}: invalid Server docs artifact metadata`)
  }
  const expectedDigest = sha256(JSON.stringify(artifactContent(artifact)))
  if (expectedDigest !== integrityRecord['contentDigest']) {
    throw new Error(`${context}: content digest mismatch`)
  }
  if (artifact['schemaVersion'] === 2) return artifact as ServerDocsArtifact

  const documents = artifact['documents']
  if (!Array.isArray(documents)) {
    throw new Error(`${context}: legacy Server docs artifact has no documents`)
  }
  const pages = documents.map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${context}: documents[${index}] is invalid`)
    }
    const document = value as JsonRecord
    const locale = document['locale']
    if (
      typeof document['id'] !== 'string' ||
      typeof document['owner'] !== 'string' ||
      typeof document['route'] !== 'string' ||
      typeof document['title'] !== 'string' ||
      typeof document['description'] !== 'string' ||
      (locale !== 'en' && locale !== 'ja') ||
      typeof document['file'] !== 'string' ||
      typeof document['manifest'] !== 'string' ||
      typeof document['body'] !== 'string'
    ) {
      throw new Error(`${context}: documents[${index}] is invalid`)
    }
    return {
      id: document['id'],
      owner: document['owner'],
      route: document['route'],
      kind: document['route'] === 'overview' ? 'overview' : 'guide',
      audience: 'user',
      publication: 'public',
      searchable: true,
      canonicalLocale: locale,
      title: { [locale]: document['title'] },
      description: { [locale]: document['description'] },
      sources: {
        [locale]: {
          locale,
          file: document['file'],
          manifest: document['manifest'],
          body: document['body'],
        },
      },
    }
  })
  const { documents: _documents, integrity: _integrity, ...legacyContent } = artifact
  const normalizedContent = { ...legacyContent, schemaVersion: 2, pages }
  return {
    ...normalizedContent,
    integrity: {
      ...integrityRecord,
      contentDigest: sha256(JSON.stringify(normalizedContent)),
    },
  } as unknown as ServerDocsArtifact
}

function versionParts(value: string): [number, number, number, number | null] {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/)
  if (!match) throw new Error(`Invalid Server release version ${value}`)
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? null : Number(match[4]),
  ]
}

export function compareServerVersions(left: string, right: string): number {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  for (const index of [0, 1, 2] as const) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index]
  }
  const leftBeta = leftParts[3]
  const rightBeta = rightParts[3]
  if (leftBeta === rightBeta) return 0
  if (leftBeta === null) return 1
  if (rightBeta === null) return -1
  return leftBeta - rightBeta
}

async function artifactFromFile(filePath: string): Promise<ServerDocsArtifact> {
  return parseArtifact(JSON.parse(await readFile(filePath, 'utf8')), filePath)
}

async function artifactFromUrl(url: string, context: string): Promise<ServerDocsArtifact> {
  const response = await fetch(url, { headers: { 'user-agent': 'shumoku-docs-build' } })
  if (!response.ok) throw new Error(`${context}: download failed with ${response.status}`)
  return parseArtifact(await response.json(), context)
}

async function githubArtifacts(): Promise<ServerDocsArtifact[]> {
  const repository = process.env['SHUMOKU_DOCS_GITHUB_REPOSITORY'] ?? 'konoe-akitoshi/shumoku'
  const releases: GitHubRelease[] = []
  let page = 1
  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'shumoku-docs-build',
          ...(process.env['GITHUB_TOKEN']
            ? { authorization: `Bearer ${process.env['GITHUB_TOKEN']}` }
            : {}),
        },
      },
    )
    if (!response.ok) throw new Error(`GitHub releases request failed with ${response.status}`)
    const batch = (await response.json()) as GitHubRelease[]
    releases.push(...batch)
    if (batch.length < 100) break
    page += 1
  }
  const serverReleases = releases.filter(
    (release) => !release.draft && /^server-v\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(release.tag_name),
  )
  const artifacts: ServerDocsArtifact[] = []
  for (const release of serverReleases) {
    const version = release.tag_name.slice('server-v'.length)
    const assetName = `server-docs-${version}.json`
    const asset = release.assets.find((candidate) => candidate.name === assetName)
    // Releases predating docs artifacts have no pages to preserve.
    if (!asset) continue
    const artifact = await artifactFromUrl(asset.browser_download_url, assetName)
    if (
      artifact.release.tag !== release.tag_name ||
      artifact.release.version !== version ||
      artifact.release.channel !== (release.prerelease ? 'beta' : 'stable')
    ) {
      throw new Error(`${assetName}: release metadata does not match ${release.tag_name}`)
    }
    artifacts.push(artifact)
  }
  if (artifacts.length === 0) throw new Error('No Server docs release artifact is available')
  return artifacts
}

export function createVersionsModel(artifacts: ServerDocsArtifact[]) {
  const byVersion = new Map<string, ServerDocsArtifact>()
  for (const artifact of artifacts) {
    if (byVersion.has(artifact.release.version)) {
      throw new Error(`Duplicate Server docs version ${artifact.release.version}`)
    }
    byVersion.set(artifact.release.version, artifact)
  }
  const versions = [...byVersion.values()].sort((left, right) => {
    if (left.release.channel === 'development') return -1
    if (right.release.channel === 'development') return 1
    return compareServerVersions(right.release.version, left.release.version)
  })
  const latest = versions.find((artifact) => artifact.release.channel === 'stable')?.release.version
  const beta = versions.find((artifact) => artifact.release.channel === 'beta')?.release.version
  const next = versions.find((artifact) => artifact.release.channel === 'development')?.release
    .version
  return {
    schemaVersion: 1,
    aliases: {
      ...(latest ? { latest } : {}),
      ...(beta ? { beta } : {}),
      ...(next ? { next } : {}),
    },
    versions,
  }
}

if (import.meta.main) {
  const argumentsList = process.argv.slice(2)
  const artifacts =
    process.env['SHUMOKU_DOCS_SERVER_RELEASES'] === 'github'
      ? await githubArtifacts()
      : await Promise.all(
          (argumentsList.length > 0 ? argumentsList : [defaultArtifact]).map((filePath) =>
            artifactFromFile(path.resolve(repositoryRoot, filePath)),
          ),
        )
  if (process.env['SHUMOKU_DOCS_INCLUDE_NEXT'] === 'true') {
    if (!artifacts.some(({ release }) => release.version === 'next')) {
      artifacts.push(await artifactFromFile(defaultArtifact))
    }
  }
  const model = createVersionsModel(artifacts)
  await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`)
  console.log(
    `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${model.versions.map(({ release }) => release.version).join(', ')})`,
  )
}
