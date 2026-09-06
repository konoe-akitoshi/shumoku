import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { machinePage, xmlEscape } from './machine-page'

const dist = fileURLToPath(new URL('../../../apps/docs/dist/', import.meta.url))
async function htmlFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await htmlFiles(file)))
    else if (entry.name.endsWith('.html')) files.push(file)
  }
  return files.sort()
}
const pages = []
for (const file of await htmlFiles(dist)) {
  const page = machinePage(await readFile(file, 'utf8'))
  if (!page) continue
  const target = path.join(dist, `${page.pathname}.md`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, page.markdown)
  pages.push(page)
}
if (!pages.length) throw new Error('No canonical documentation pages found')
const groups = new Map<string, typeof pages>()
for (const page of pages) {
  const group = groups.get(page.scope) ?? []
  group.push(page)
  groups.set(page.scope, group)
}
const root = [
  '# Shumoku documentation',
  '',
  '> Network topology visualization: libraries, CLI and Server.',
  '',
  'Markdown mirrors are generated from the same rendered body as the human documentation.',
  'Library and CLI documentation follows the current source. Server versions are independent;',
  'next is development, beta is prerelease, and neither implies a stable release.',
  'Choose one language and one Server version. Do not combine APIs from different versions.',
  '',
  '## Documentation indexes',
  '',
]
for (const [scope, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const url = `https://docs.shumoku.dev/${scope}/llms.txt`
  const description = entries[0]?.channel ? ` (${entries[0].channel})` : ''
  root.push(`- [${scope}${description}](${url}): ${entries.length} pages`)
  const index = [
    `# Shumoku ${scope}${description}`,
    '',
    '> Canonical Markdown documentation index.',
    '',
  ]
  for (const page of entries)
    index.push(`- [${page.title.replace(/[[\]\n]/g, '')}](${page.url}.md)`)
  const target = path.join(dist, scope, 'llms.txt')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, `${index.join('\n')}\n`)
}
await writeFile(path.join(dist, 'llms.txt'), `${root.join('\n')}\n`)
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${xmlEscape(page.url)}</loc></url>`).join('\n')}\n</urlset>\n`,
)
console.log(
  `[docs] Machine discovery generated (${pages.length} Markdown pages, ${groups.size} indexes, sitemap)`,
)
