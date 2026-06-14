const DEFAULT_RELEASES_API_URL =
  'https://api.github.com/repos/konoe-akitoshi/shumoku/releases?per_page=50'
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 5000

declare const __SHUMOKU_VERSION__: string | undefined
declare const __SHUMOKU_COMMIT__: string | undefined
declare const __SHUMOKU_BUILD_DATE__: string | undefined
declare const __SHUMOKU_CHANNEL__: string | undefined

export type ReleaseChannel = 'stable' | 'beta' | 'development'
export type DeploymentType = 'docker' | 'docker-compose' | 'kubernetes' | 'source'
export type UpdateStatus = 'available' | 'current' | 'unknown' | 'disabled'

export interface BuildInfo {
  version: string
  channel: ReleaseChannel
  commit?: string
  builtAt?: string
  deployment: DeploymentType
}

export interface UpdateInfo {
  status: UpdateStatus
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  publishedAt?: string
  checkedAt?: string
  error?: string
}

export interface SystemInfo {
  build: BuildInfo
  update: UpdateInfo
}

interface GitHubRelease {
  tag_name?: unknown
  html_url?: unknown
  published_at?: unknown
  draft?: unknown
  prerelease?: unknown
}

interface UpdateCheckerOptions {
  fetcher?: typeof fetch
  now?: () => number
  cacheTtlMs?: number
  timeoutMs?: number
  releasesApiUrl?: string
}

function compiledValue(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined
}

function deploymentType(value: string | undefined): DeploymentType {
  if (value === 'docker-compose' || value === 'kubernetes' || value === 'source') return value
  return value === 'docker' ? value : 'source'
}

export function getBuildInfo(): BuildInfo {
  const version =
    (typeof __SHUMOKU_VERSION__ !== 'undefined' ? compiledValue(__SHUMOKU_VERSION__) : undefined) ??
    compiledValue(process.env['SHUMOKU_VERSION']) ??
    'development'
  const commit =
    (typeof __SHUMOKU_COMMIT__ !== 'undefined' ? compiledValue(__SHUMOKU_COMMIT__) : undefined) ??
    compiledValue(process.env['SHUMOKU_COMMIT'])
  const builtAt =
    (typeof __SHUMOKU_BUILD_DATE__ !== 'undefined'
      ? compiledValue(__SHUMOKU_BUILD_DATE__)
      : undefined) ?? compiledValue(process.env['SHUMOKU_BUILD_DATE'])
  const compiledChannel =
    typeof __SHUMOKU_CHANNEL__ !== 'undefined' ? compiledValue(__SHUMOKU_CHANNEL__) : undefined

  return {
    version,
    channel:
      compiledChannel === 'stable' || compiledChannel === 'beta' ? compiledChannel : 'development',
    commit,
    builtAt,
    deployment: deploymentType(process.env['SHUMOKU_DEPLOYMENT']),
  }
}

export function parseReleaseVersion(tag: string): string | null {
  const match = tag.match(/^(?:server-v)?(\d+\.\d+\.\d+(?:-beta\.\d+)?)$/)
  return match?.[1] ?? null
}

export function compareVersions(left: string, right: string): number | null {
  const leftVersion = parseReleaseVersion(left)
  const rightVersion = parseReleaseVersion(right)
  if (!leftVersion || !rightVersion) return null

  const [leftCore, leftPrerelease] = leftVersion.split('-beta.')
  const [rightCore, rightPrerelease] = rightVersion.split('-beta.')
  if (!leftCore || !rightCore) return null

  const leftParts = leftCore.split('.').map(Number)
  const rightParts = rightCore.split('.').map(Number)
  for (const [index, leftPart] of leftParts.entries()) {
    const rightPart = rightParts[index]
    if (rightPart === undefined) return null
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1
  }

  if (leftPrerelease === undefined && rightPrerelease === undefined) return 0
  if (leftPrerelease === undefined) return 1
  if (rightPrerelease === undefined) return -1

  const leftBeta = Number(leftPrerelease)
  const rightBeta = Number(rightPrerelease)
  if (!Number.isInteger(leftBeta) || !Number.isInteger(rightBeta)) return null
  if (leftBeta !== rightBeta) return leftBeta > rightBeta ? 1 : -1
  return 0
}

function isServerRelease(candidate: unknown): candidate is GitHubRelease & { tag_name: string } {
  if (typeof candidate !== 'object' || candidate === null) return false

  const release = candidate as GitHubRelease
  const version =
    typeof release.tag_name === 'string' ? parseReleaseVersion(release.tag_name) : null
  return (
    typeof release.tag_name === 'string' &&
    release.tag_name.startsWith('server-v') &&
    release.draft !== true &&
    version !== null &&
    (release.prerelease !== true || version.includes('-beta.'))
  )
}

export class UpdateChecker {
  private fetcher: typeof fetch
  private now: () => number
  private cacheTtlMs: number
  private timeoutMs: number
  private releasesApiUrl: string
  private cached: { expiresAt: number; value: UpdateInfo } | null = null
  private pending: Promise<UpdateInfo> | null = null

  constructor(options: UpdateCheckerOptions = {}) {
    this.fetcher = options.fetcher ?? fetch
    this.now = options.now ?? Date.now
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.releasesApiUrl =
      options.releasesApiUrl ?? process.env['SHUMOKU_RELEASES_API_URL'] ?? DEFAULT_RELEASES_API_URL
  }

  async get(
    currentVersion: string,
    channel: ReleaseChannel = 'stable',
    force = false,
  ): Promise<UpdateInfo> {
    if (process.env['SHUMOKU_UPDATE_CHECK'] === 'off') {
      return { status: 'disabled', currentVersion }
    }

    if (!force && this.cached && this.cached.expiresAt > this.now()) {
      return this.cached.value
    }
    if (this.pending) return this.pending

    this.pending = this.fetchLatest(currentVersion, channel)
    try {
      const value = await this.pending
      this.cached = { expiresAt: this.now() + this.cacheTtlMs, value }
      return value
    } finally {
      this.pending = null
    }
  }

  private async fetchLatest(currentVersion: string, channel: ReleaseChannel): Promise<UpdateInfo> {
    const checkedAt = new Date(this.now()).toISOString()
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': `shumoku-server/${currentVersion}`,
        'X-GitHub-Api-Version': '2022-11-28',
      }
      const token = process.env['SHUMOKU_GITHUB_TOKEN']
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await this.fetcher(this.releasesApiUrl, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) {
        throw new Error(`GitHub Releases returned HTTP ${response.status}`)
      }

      const releases = (await response.json()) as unknown
      if (!Array.isArray(releases)) {
        throw new Error('GitHub Releases response is not an array')
      }
      let release: (GitHubRelease & { tag_name: string }) | undefined
      for (const candidate of releases) {
        if (!isServerRelease(candidate)) continue
        const candidateVersion = parseReleaseVersion(candidate.tag_name)
        if (!candidateVersion) continue
        if (channel === 'stable' && candidateVersion.includes('-beta.')) continue
        if (!release || compareVersions(candidate.tag_name, release.tag_name) === 1) {
          release = candidate
        }
      }
      if (!release) {
        throw new Error('No Shumoku Server release tag was found')
      }
      const latestVersion = parseReleaseVersion(release.tag_name)
      if (!latestVersion) throw new Error('Invalid Shumoku Server release tag')

      const comparison = compareVersions(currentVersion, latestVersion)
      return {
        status: comparison === null ? 'unknown' : comparison < 0 ? 'available' : 'current',
        currentVersion,
        latestVersion,
        releaseUrl: typeof release.html_url === 'string' ? release.html_url : undefined,
        publishedAt: typeof release.published_at === 'string' ? release.published_at : undefined,
        checkedAt,
      }
    } catch (error) {
      return {
        status: 'unknown',
        currentVersion,
        checkedAt,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

const updateChecker = new UpdateChecker()

export async function getSystemInfo(force = false): Promise<SystemInfo> {
  const build = getBuildInfo()
  return {
    build,
    update: await updateChecker.get(build.version, build.channel, force),
  }
}
