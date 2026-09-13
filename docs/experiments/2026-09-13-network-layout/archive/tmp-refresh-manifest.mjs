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
    'Network layout experiment archive through V8 distributed node attachments, wire-owned channel capacity, rigid dependency rows and required directional spacing. Latest checkpoint uses node area ratio 0.15 and wire clearance scale 1.5. Hashes cover archived artifacts, not this manifest or the work log.',
  fileCount: files.length,
  totalBytes: files.reduce((s, file) => s + file.bytes, 0),
  files,
}
await Bun.write(
  new URL('../manifest.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log(`Recorded ${manifest.fileCount} artifacts, ${manifest.totalBytes} bytes`)
