import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import config from '../.changeset/config.json'
import { hasPendingReleases } from './changeset-status'

const require = createRequire(import.meta.url)
const cli = require.resolve('@changesets/cli/bin.js')
const directories: string[] = []

function fixture(changeset?: string): string {
  const cwd = mkdtempSync(join(tmpdir(), 'shumoku-changesets-test-'))
  directories.push(cwd)
  for (const path of ['.changeset', 'packages/core', 'packages/wrapper', 'packages/server']) {
    mkdirSync(join(cwd, path), { recursive: true })
  }
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: 'release-fixture',
      private: true,
      packageManager: 'bun@1.3.4',
      workspaces: ['packages/*'],
    }),
  )
  symlinkSync(resolve(import.meta.dir, '../node_modules'), join(cwd, 'node_modules'), 'dir')
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n')
  writeFileSync(join(cwd, '.changeset/config.json'), JSON.stringify(config))
  for (const [directory, manifest] of [
    ['core', { name: '@fixture/core', version: '1.2.3' }],
    [
      'wrapper',
      {
        name: '@fixture/wrapper',
        version: '4.5.6',
        dependencies: { '@fixture/core': 'workspace:*' },
      },
    ],
    ['server', { name: '@fixture/server', version: '7.8.9', private: true }],
  ] as const) {
    writeFileSync(join(cwd, `packages/${directory}/package.json`), JSON.stringify(manifest))
  }
  execFileSync('bun', ['install', '--lockfile-only', '--ignore-scripts'], { cwd, stdio: 'pipe' })
  execFileSync('git', ['init', '--initial-branch=main'], { cwd, stdio: 'pipe' })
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd })
  execFileSync('git', ['config', 'user.name', 'Release fixture'], { cwd })
  execFileSync('git', ['add', '.'], { cwd })
  execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture'], {
    cwd,
    stdio: 'pipe',
  })
  if (changeset !== undefined) writeFileSync(join(cwd, '.changeset/change.md'), changeset)
  return cwd
}

function run(cwd: string, args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync('node', [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  })
}

function manifest(cwd: string, name: string) {
  return JSON.parse(readFileSync(join(cwd, `packages/${name}/package.json`), 'utf8')) as {
    version: string
    dependencies?: Record<string, string>
  }
}

const patch = '---\n"@fixture/core": patch\n---\n\nFix the fixture.\n'

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('Changesets v3 with the repository release configuration', () => {
  test('versions independent packages, updates dependents, and leaves private products alone', () => {
    const cwd = fixture(patch)
    expect(hasPendingReleases(cwd)).toBe(true)
    const result = run(cwd, ['version'])
    expect(result.stderr + result.stdout).not.toContain('Internal Error')
    expect(result.status).toBe(0)
    const frozen = spawnSync(
      'bun',
      ['install', '--frozen-lockfile', '--lockfile-only', '--ignore-scripts'],
      { cwd, encoding: 'utf8' },
    )
    expect(frozen.stderr).not.toContain('lockfile had changes')
    expect(frozen.status).toBe(0)
    expect(manifest(cwd, 'core').version).toBe('1.2.4')
    expect(manifest(cwd, 'wrapper').version).toBe('4.5.7')
    expect(manifest(cwd, 'server').version).toBe('7.8.9')
    expect(readFileSync(join(cwd, 'packages/core/CHANGELOG.md'), 'utf8')).toContain(
      'Fix the fixture.',
    )
  })

  test('creates beta snapshots with the existing naming and workspace dependency policy', () => {
    const cwd = fixture(patch)
    expect(hasPendingReleases(cwd)).toBe(true)
    expect(run(cwd, ['version', '--snapshot', 'beta']).status).toBe(0)
    expect(manifest(cwd, 'core').version).toMatch(/^0\.0\.0-beta-\d{14}$/)
    expect(manifest(cwd, 'wrapper').version).toBe(manifest(cwd, 'core').version)
    expect(manifest(cwd, 'wrapper').dependencies?.['@fixture/core']).toBe('workspace:*')
    expect(manifest(cwd, 'server').version).toBe('7.8.9')
  })

  test.each([undefined, '---\n---\n'])('skips a beta with no release intent (%s)', (changeset) => {
    const cwd = fixture(changeset)
    expect(hasPendingReleases(cwd)).toBe(false)
    const output = join(cwd, 'github-output')
    const result = spawnSync('bun', [resolve(import.meta.dir, 'changeset-status.ts')], {
      cwd,
      env: { ...process.env, GITHUB_OUTPUT: output },
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(readFileSync(output, 'utf8')).toBe('has-releases=false\n')
    // v3 returns 1 for no changesets; the beta workflow must skip before calling version.
    if (changeset === undefined) expect(run(cwd, ['version']).status).toBe(1)
    expect(manifest(cwd, 'core').version).toBe('1.2.3')
  })

  test('does not treat malformed changesets as an empty release', () => {
    const cwd = fixture('---\n"@fixture/missing": patch\n---\nInvalid package.\n')
    expect(() => hasPendingReleases(cwd)).toThrow()
  })

  test('emits the Action v2 tag report and omits private product tags', () => {
    const cwd = fixture()
    const output = join(cwd, 'events.ndjson')
    expect(run(cwd, ['git-tag'], { CHANGESETS_OUTPUT: output }).status).toBe(0)
    const report = readFileSync(output, 'utf8')
    const events = report
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toContainEqual({
      type: 'git-tag',
      tag: '@fixture/core@1.2.3',
      packageName: '@fixture/core',
    })
    expect(events).toContainEqual({
      type: 'git-tag',
      tag: '@fixture/wrapper@4.5.6',
      packageName: '@fixture/wrapper',
    })
    expect(events).toHaveLength(2)
    expect(run(cwd, ['git-tag'], { CHANGESETS_OUTPUT: output }).status).toBe(0)
    expect(readFileSync(output, 'utf8')).toBe(report)
  })
})
