import { readFile } from 'node:fs/promises'

export interface ServerReleaseIntent {
  release: boolean
  channel: 'development' | 'beta' | 'stable'
  version: string
  tag: string
  platforms: string
}

export function resolveServerReleaseIntent(
  version: string,
  eventName: string,
  ref: string,
  previousVersion?: string,
): ServerReleaseIntent {
  const versionRelease =
    eventName === 'push' &&
    ref === 'refs/heads/main' &&
    previousVersion !== undefined &&
    previousVersion !== version
  const release = versionRelease
  const channel = release ? (version.includes('-beta.') ? 'beta' : 'stable') : 'development'
  const tag = versionRelease ? `server-v${version}` : ''

  return {
    release,
    channel,
    version,
    tag,
    platforms: release ? '["linux/amd64","linux/arm64"]' : '["linux/amd64"]',
  }
}

function readPreviousVersion(before: string | undefined): string | undefined {
  if (!before) return undefined
  const result = Bun.spawnSync(['git', 'show', `${before}:apps/server/package.json`])
  if (result.exitCode !== 0) return undefined

  const manifest = JSON.parse(new TextDecoder().decode(result.stdout)) as { version?: string }
  return manifest.version
}

if (import.meta.main) {
  const eventName = Bun.argv[2] ?? ''
  const ref = Bun.argv[3] ?? ''
  const before = Bun.argv[4]
  const manifest = JSON.parse(await readFile('apps/server/package.json', 'utf8')) as {
    version?: string
  }
  if (!manifest.version) throw new Error('apps/server/package.json does not contain a version')

  const intent = resolveServerReleaseIntent(
    manifest.version,
    eventName,
    ref,
    readPreviousVersion(before),
  )
  for (const [key, value] of Object.entries(intent)) {
    console.log(`${key}=${value}`)
  }
}
