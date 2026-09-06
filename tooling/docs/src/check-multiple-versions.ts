import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createVersionsModel, parseArtifact } from './sync-server-versions'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const docs = path.join(root, 'apps/docs')
const modelPath = path.join(docs, '.generated/server-versions.json')
const original = await readFile(modelPath, 'utf8')
const source = JSON.parse(
  await readFile(path.join(docs, '.generated/server-artifact.json'), 'utf8'),
)

function run(args: string[], cwd = docs) {
  const result = spawnSync('bun', args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Failed: bun ${args.join(' ')}`)
}

// Build complete, deterministic versions from real generated contracts, without GitHub access.
const fixtures = ['0.0.1', '0.0.2', '0.0.3-beta.1'].map((version) => {
  const { integrity: _integrity, ...content } = JSON.parse(
    JSON.stringify(source).replaceAll('/server/next', `/server/${version}`),
  )
  content.release = {
    ...content.release,
    version,
    productVersion: version,
    channel: version.includes('beta') ? 'beta' : 'stable',
    tag: `server-v${version}`,
  }
  return parseArtifact(
    {
      ...content,
      integrity: {
        algorithm: 'sha256',
        inputs: {},
        contentDigest: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
      },
    },
    `fixture ${version}`,
  )
})

try {
  await writeFile(modelPath, JSON.stringify(createVersionsModel(fixtures)))
  run(['x', '--no-install', 'astro', 'build'])
  run(['x', '--no-install', 'pagefind', '--site', 'dist'])
  run(['src/check-server-versions.ts'], path.join(root, 'tooling/docs'))
  for await (const file of new Bun.Glob('**/*.html').scan(path.join(docs, 'dist'))) {
    const html = await readFile(path.join(docs, 'dist', file), 'utf8')
    for (const filter of html.matchAll(/data-pagefind-filter="([^"]+)"/g)) {
      if (/:[^"\n]*,/.test(filter[1] ?? '')) {
        throw new Error(`${file}: inline Pagefind filters must use separate elements`)
      }
    }
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1]
      if (!href) continue
      const url = new URL(href, `https://docs.shumoku.dev/${file}`)
      if (url.origin !== 'https://docs.shumoku.dev') continue
      const target = path.join(docs, 'dist', decodeURIComponent(url.pathname))
      const exists = await Promise.all(
        [target, path.join(target, 'index.html'), `${target}.html`].map((candidate) =>
          access(candidate).then(
            () => true,
            () => false,
          ),
        ),
      )
      if (!exists.some(Boolean)) throw new Error(`${file}: broken link ${href}`)
    }
  }
  const apiPage = await readFile(path.join(docs, 'dist/ja/server/0.0.1/api.html'), 'utf8')
  if (!apiPage.includes('href="/ja/server/0.0.2/api"'))
    throw new Error('Version switch lost API page')
  console.log('[docs] Multiple-version build, switch links, and internal links passed')
} finally {
  await writeFile(modelPath, original)
}
