// Collects public docs from sibling apps into the site's content tree.
//
// Each app owns its user-facing docs in apps/<app>/docs/. Only .md/.mdx files
// whose frontmatter contains `public: true` are published; everything else
// (dev notes, design docs) stays private by construction — private files never
// enter the site build. Sidebar meta.*.json files are copied only from
// directories that contain at least one public doc.
//
// Destinations under content/docs/<app>/ are generated (gitignored) and fully
// rebuilt on every run, so deletions in the source propagate.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const docsApp = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appsDir = resolve(docsApp, '..')
const contentDocs = join(docsApp, 'content', 'docs')

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/
const PUBLIC_RE = /^public:\s*true\s*$/m

function isPublic(filePath) {
  const match = readFileSync(filePath, 'utf8').match(FRONTMATTER_RE)
  return match ? PUBLIC_RE.test(match[1]) : false
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return []
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

let total = 0
for (const app of readdirSync(appsDir, { withFileTypes: true })) {
  if (!app.isDirectory() || app.name === 'docs') continue
  const sourceDir = join(appsDir, app.name, 'docs')
  if (!existsSync(sourceDir)) continue

  const files = walk(sourceDir)
  const publicDocs = files.filter((f) => /\.(md|mdx)$/.test(f) && isPublic(f))
  const publicDirs = new Set(publicDocs.map((f) => dirname(f)))
  const metaFiles = files.filter((f) => /(^|[\\/])meta(\.[\w-]+)?\.json$/.test(f))
  const toCopy = [...publicDocs, ...metaFiles.filter((f) => publicDirs.has(dirname(f)))]

  const destDir = join(contentDocs, app.name)
  rmSync(destDir, { recursive: true, force: true })
  if (toCopy.length === 0) continue

  for (const file of toCopy) {
    const dest = join(destDir, relative(sourceDir, file))
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(file, dest)
  }
  total += toCopy.length
  console.log(`[collect-docs] ${app.name}: ${toCopy.length} files -> content/docs/${app.name}`)
}
console.log(`[collect-docs] done (${total} files)`)
