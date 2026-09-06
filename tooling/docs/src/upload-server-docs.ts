import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const [tag, file] = process.argv.slice(2)
if (!tag || !file) throw new Error('Usage: upload-server-docs.ts <tag> <artifact>')
function gh(args: string[]) {
  const result = spawnSync('gh', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`GitHub release operation failed: ${result.stderr}`)
  return result.stdout
}
const name = path.basename(file)
const release = JSON.parse(gh(['release', 'view', tag, '--json', 'assets'])) as {
  assets: Array<{ name: string }>
}
if (!release.assets.some((asset) => asset.name === name)) {
  gh(['release', 'upload', tag, file])
} else {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'shumoku-docs-upload-'))
  try {
    gh(['release', 'download', tag, '--pattern', name, '--dir', directory])
    const [existing, proposed] = await Promise.all([
      readFile(path.join(directory, name)),
      readFile(file),
    ])
    if (!existing.equals(proposed))
      throw new Error(`${tag}: refusing to overwrite different documentation`)
    console.log(`${tag}: identical documentation already published`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
