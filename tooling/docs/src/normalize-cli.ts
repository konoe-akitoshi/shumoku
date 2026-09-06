import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderCommand } from '../../../apps/cli/src/command.js'

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const packagePath = path.join(repositoryRoot, 'apps/cli/package.json')
const outputPath = path.join(repositoryRoot, 'apps/docs/.generated/cli.json')

const packageValue: unknown = JSON.parse(await readFile(packagePath, 'utf8'))
if (typeof packageValue !== 'object' || packageValue === null || Array.isArray(packageValue)) {
  throw new Error('CLI package.json must be an object')
}
const version = (packageValue as Record<string, unknown>)['version']
if (typeof version !== 'string') throw new Error('CLI package.json has no version')

const model = {
  schemaVersion: 1,
  package: { name: '@shumoku/cli', version },
  commands: [renderCommand],
  source: {
    file: 'apps/cli/src/command.ts',
    url: 'https://github.com/konoe-akitoshi/shumoku/blob/main/apps/cli/src/command.ts',
  },
}

await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`)
console.log(`[docs] generated ${path.relative(repositoryRoot, outputPath)} (1 command)`)
