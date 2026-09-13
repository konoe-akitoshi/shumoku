import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'

const directory = new URL('./', import.meta.url)
const names = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort()
const files = await Promise.all(
  names.map(async (name) => {
    const bytes = await Bun.file(new URL(name, directory)).arrayBuffer()
    return {
      path: `archive/${name}`,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
    }
  }),
)
const manifest = {
  savedOn: '2026-09-13',
  description:
    'Current experiment is V8 dependency-y based on e1094bd5 with structural multi-root detection added in the working tree. Coupled trials remain rejected. Hashes cover archived artifacts only; structure-analysis is outside the archive inventory.',
  current: {
    variant: 'dependency-y',
    sourceCommit: 'e1094bd5',
    workingTreeExtension: 'structural-multi-root-detection',
    upstreamModule: 'structure-analysis/upstream.mjs',
    renderer: 'archive/tmp-test6-v8-elastic-render.mjs',
    arguments: ['--dependency-y'],
    report: 'archive/tmp-test6-v8-dependency-y-report.json',
    image: 'archive/tmp-test6-v8-dependency-y.png',
  },
  rejectedTrials: [
    {
      variant: 'coupled-search',
      reason:
        'Interior readability regressed; constraint removal and dependency objective changes were confounded.',
      renderer: 'archive/tmp-test6-v8-coupled-render.mjs',
      report: 'archive/tmp-test6-v8-coupled-search-report.json',
    },
  ],
  fileCount: files.length,
  totalBytes: files.reduce((s, file) => s + file.bytes, 0),
  files,
}
await Bun.write(
  new URL('../manifest.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log(`Recorded ${manifest.fileCount} artifacts, ${manifest.totalBytes} bytes`)
