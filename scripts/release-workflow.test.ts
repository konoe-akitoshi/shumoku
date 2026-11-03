import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { YAML } from 'bun'
import manifest from '../package.json'

interface ReleaseStep {
  name?: string
  if?: string
  run?: string
  id?: string
  uses?: string
  with?: Record<string, unknown>
  env?: Record<string, unknown>
}

const workflow = YAML.parse(
  readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
) as {
  on: Record<string, unknown>
  jobs: { release: { permissions: Record<string, string>; steps: ReleaseStep[] } }
}
const changesets = workflow.jobs.release.steps.find((step) => step.id === 'changesets')

describe('npm release workflow compatibility', () => {
  test('keeps the reviewed Action v2 and CLI v3 contract together', () => {
    // An action SHA is opaque: keep this independent of the workflow's version comment.
    // Review CLI and input compatibility before approving a different action revision.
    expect(changesets?.uses).toBe('changesets/action@ae32849d5ba541f9ae29e40e22a623bc13562f51')
    expect(manifest.devDependencies['@changesets/cli']).toMatch(/^\^3\./)
  })

  test('uses the v2 inputs and suppresses GitHub releases', () => {
    expect(changesets?.with).toEqual({
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression
      'github-token': '${{ secrets.GITHUB_TOKEN }}',
      'publish-script': 'bun run release',
      'version-script': 'bun run version-packages',
      'pr-title': 'chore: release packages',
      'commit-message': 'chore: release packages',
      'create-github-releases': false,
    })
    expect(changesets?.env?.GITHUB_TOKEN).toBeUndefined()
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression
    expect(changesets?.env?.NODE_AUTH_TOKEN).toBe('${{ secrets.NPM_TOKEN }}')
  })

  test('dispatches validation only after creating or updating a release PR', () => {
    expect(workflow.on).toEqual({ push: { branches: ['main'] } })
    expect(workflow.jobs.release.permissions.actions).toBe('write')
    const validation = workflow.jobs.release.steps.find(
      (step) => step.name === 'Validate release pull request',
    )
    expect(validation?.if).toBe("steps.changesets.outputs.pr-number != ''")
    expect(validation?.run?.trim().split('\n')).toEqual([
      'gh workflow run ci.yml --ref changeset-release/main',
      'gh workflow run server-release.yml --ref changeset-release/main',
    ])
    for (const filename of ['ci.yml', 'server-release.yml']) {
      const validationWorkflow = YAML.parse(
        readFileSync(new URL(`../.github/workflows/${filename}`, import.meta.url), 'utf8'),
      ) as { on: Record<string, unknown> }
      expect(validationWorkflow.on).toHaveProperty('workflow_dispatch')
    }
  })

  test('keeps versioning separate from publishing', () => {
    expect(manifest.scripts['version-packages']).toBe('changeset version')
    expect(manifest.scripts.release).toBe('bun run build:packages && changeset publish')
  })
})

const beta = YAML.parse(
  readFileSync(new URL('../.github/workflows/release-beta.yml', import.meta.url), 'utf8'),
) as { jobs: { publish: { steps: (ReleaseStep & { name?: string; if?: string })[] } } }

test('both release workflows explicitly configure Node 24 and npm authentication', () => {
  for (const steps of [workflow.jobs.release.steps, beta.jobs.publish.steps]) {
    const node = steps.find((step) => step.uses?.startsWith('actions/setup-node@'))
    expect(node?.with).toMatchObject({
      'node-version': 24,
      'registry-url': 'https://registry.npmjs.org',
      'package-manager-cache': false,
    })
  }
})

test('beta skips version, build, and publish without pending releases', () => {
  for (const name of ['Create snapshot versions', 'Build packages', 'Publish beta packages']) {
    const step = beta.jobs.publish.steps.find((step) => step.name === name)
    expect(step?.if).toBe("steps.pending.outputs.has-releases == 'true'")
  }
  const publish = beta.jobs.publish.steps.find((step) => step.name === 'Publish beta packages')
  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression
  expect(publish?.env?.NODE_AUTH_TOKEN).toBe('${{ secrets.NPM_TOKEN }}')
})

// npm publishes a manifest as it is written: `changeset publish` does not rewrite the workspace
// protocol, so a published package whose dependencies say `workspace:*` cannot be installed
// (@shumoku/renderer 0.1.5 and the NetBox and Zabbix plugins 0.2.30 went out that way). A
// package that is published names its workspace dependencies by version range instead.
test('a published package names its workspace dependencies by version range', () => {
  const root = new URL('../', import.meta.url)
  const workspaces = (manifest.workspaces as string[]).flatMap((pattern) => [
    ...new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: fileURLToPath(root) }),
  ])
  const offenders: string[] = []
  for (const file of workspaces) {
    const pkg = JSON.parse(readFileSync(new URL(file, root), 'utf8')) as {
      name: string
      private?: boolean
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
    if (pkg.private) continue
    for (const deps of [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
      for (const [name, range] of Object.entries(deps ?? {})) {
        if (range.startsWith('workspace:')) offenders.push(`${pkg.name} → ${name}@${range}`)
      }
    }
  }
  expect(workspaces.length).toBeGreaterThan(5)
  expect(offenders).toEqual([])
})

// Private packages are never versioned (`privatePackages.version: false`), so a changeset that
// names one is never used up. The release action sees it as pending for ever and keeps opening an
// empty release pull request instead of publishing.
test('no changeset names a private package', () => {
  const root = new URL('../', import.meta.url)
  const privateNames = new Set(
    (manifest.workspaces as string[])
      .flatMap((pattern) => [
        ...new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: fileURLToPath(root) }),
      ])
      .map(
        (file) =>
          JSON.parse(readFileSync(new URL(file, root), 'utf8')) as {
            name: string
            private?: boolean
          },
      )
      .filter((pkg) => pkg.private)
      .map((pkg) => pkg.name),
  )
  const offenders: string[] = []
  for (const file of new Bun.Glob('.changeset/*.md').scanSync({
    cwd: fileURLToPath(root),
    dot: true,
  })) {
    if (file.endsWith('README.md')) continue
    const front = readFileSync(new URL(file, root), 'utf8').split('---')[1] ?? ''
    for (const line of front.split('\n')) {
      const name = line
        .split(':')[0]
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
      if (name && privateNames.has(name)) offenders.push(`${file} → ${name}`)
    }
  }
  expect(privateNames.size).toBeGreaterThan(0)
  expect(offenders).toEqual([])
})
