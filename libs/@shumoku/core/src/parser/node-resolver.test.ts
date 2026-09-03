import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createNodeFileResolver as createLegacyResolver } from './index.js'
import { createNodeFileResolver } from './node.js'

let tempDirectory: string | undefined

afterEach(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true })
    tempDirectory = undefined
  }
})

describe('createNodeFileResolver', () => {
  it('resolves and reads files in an ESM runtime', async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'shumoku-node-resolver-'))
    const parentPath = join(tempDirectory, 'main.yaml')
    const childPath = join(tempDirectory, 'child.yaml')
    await writeFile(childPath, 'name: Child\n', 'utf8')

    const resolver = createNodeFileResolver()
    const resolvedPath = resolver.resolve(parentPath, './child.yaml')

    expect(resolvedPath).toBe(childPath)
    await expect(resolver.read(resolvedPath)).resolves.toBe('name: Child\n')
  })

  it('keeps the existing root export working', () => {
    const resolver = createLegacyResolver()

    expect(resolver.resolve('/tmp/main.yaml', './child.yaml')).toBe('/tmp/child.yaml')
  })
})
