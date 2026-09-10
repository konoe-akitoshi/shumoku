import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

/** Read the real CLI release plan; malformed configuration remains a hard failure. */
export function hasPendingReleases(cwd: string): boolean {
  const directory = mkdtempSync(join(tmpdir(), 'shumoku-changesets-status-'))
  try {
    const output = join(directory, 'status.json')
    execFileSync(
      'node',
      [require.resolve('@changesets/cli/bin.js'), 'status', '--output', output],
      {
        cwd,
        stdio: ['ignore', 'inherit', 'inherit'],
      },
    )
    const plan = JSON.parse(readFileSync(output, 'utf8')) as {
      releases: { type: string }[]
    }
    return plan.releases.some((release) => release.type !== 'none')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const pending = hasPendingReleases(process.cwd())
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone GitHub Actions step, outside Turbo
  const output = process.env.GITHUB_OUTPUT
  if (output) {
    appendFileSync(output, `has-releases=${pending}\n`)
  }
  console.log(
    pending ? 'Pending package releases found.' : 'No pending package releases; skipping beta.',
  )
}
