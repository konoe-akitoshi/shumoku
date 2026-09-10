import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { YAML } from 'bun'
import manifest from '../package.json'

interface ReleaseStep {
  id?: string
  uses?: string
  with?: Record<string, unknown>
  env?: Record<string, unknown>
}

const workflow = YAML.parse(
  readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
) as { jobs: { release: { steps: ReleaseStep[] } } }
const changesets = workflow.jobs.release.steps.find((step) => step.id === 'changesets')

describe('npm release workflow compatibility', () => {
  test('keeps the reviewed Action v1 and CLI v2 contract together', () => {
    // An action SHA is opaque: keep this independent of the workflow's version comment.
    // Review CLI and input compatibility before approving a different action revision.
    expect(changesets?.uses).toBe('changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d')
    expect(manifest.devDependencies['@changesets/cli']).toMatch(/^\^2\./)
  })

  test('uses the v1 inputs and suppresses GitHub releases', () => {
    expect(changesets?.with).toEqual({
      publish: 'bun run release',
      version: 'bun run version-packages',
      title: 'chore: release packages',
      commit: 'chore: release packages',
      createGithubReleases: false,
    })
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression
    expect(changesets?.env?.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal GitHub Actions expression
    expect(changesets?.env?.NPM_TOKEN).toBe('${{ secrets.NPM_TOKEN }}')
  })

  test('keeps versioning separate from publishing', () => {
    expect(manifest.scripts['version-packages']).toBe('changeset version')
    expect(manifest.scripts.release).toBe('bun run build:packages && changeset publish')
  })
})
