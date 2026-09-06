import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type JsonRecord = Record<string, unknown>

interface ReferenceParameter {
  name: string
  type: string
  description: string
  optional: boolean
  defaultValue?: string
}

interface ReferenceSymbol {
  id: string
  name: string
  kind: 'function'
  summary: string
  signature: string
  parameters: ReferenceParameter[]
  returns: string
  source: {
    file: string
    line: number
    url: string
  }
}

interface PackageReferenceModel {
  schemaVersion: 1
  package: {
    name: string
    version: string
  }
  symbols: ReferenceSymbol[]
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const toolingRoot = path.resolve(toolingDirectory, '..')
const repositoryRoot = path.resolve(toolingRoot, '../..')
const typedocPath = path.join(toolingRoot, '.generated/typedoc/core.json')
const outputDirectory = path.join(repositoryRoot, 'apps/docs/.generated')
const outputPath = path.join(outputDirectory, 'core.json')
const packagePath = path.join(repositoryRoot, 'libs/@shumoku/core/package.json')

function asRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`)
  }
  return value as JsonRecord
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(record: JsonRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function commentText(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ''
  const comment = value as JsonRecord
  return asArray(comment['summary'])
    .map((part) => {
      if (typeof part !== 'object' || part === null || Array.isArray(part)) return ''
      return readString(part as JsonRecord, 'text') ?? ''
    })
    .join('')
    .trim()
}

function renderType(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'unknown'
  const type = value as JsonRecord
  const kind = readString(type, 'type')

  if (kind === 'intrinsic' || kind === 'reference' || kind === 'typeParameter') {
    const name = readString(type, 'name') ?? 'unknown'
    const argumentsText = asArray(type['typeArguments']).map(renderType)
    return argumentsText.length > 0 ? `${name}<${argumentsText.join(', ')}>` : name
  }
  if (kind === 'array') return `${renderType(type['elementType'])}[]`
  if (kind === 'union') return asArray(type['types']).map(renderType).join(' | ')
  if (kind === 'intersection') return asArray(type['types']).map(renderType).join(' & ')
  if (kind === 'tuple') return `[${asArray(type['elements']).map(renderType).join(', ')}]`
  if (kind === 'literal') return JSON.stringify(type['value']) ?? 'undefined'
  if (kind === 'typeOperator') {
    return `${readString(type, 'operator') ?? ''} ${renderType(type['target'])}`.trim()
  }
  if (kind === 'reflection') {
    const declaration = asRecord(type['declaration'], 'reflection declaration')
    const properties = asArray(declaration['children']).map((childValue) => {
      const child = asRecord(childValue, 'reflection property')
      const flags =
        typeof child['flags'] === 'object' &&
        child['flags'] !== null &&
        !Array.isArray(child['flags'])
          ? (child['flags'] as JsonRecord)
          : {}
      const optional = flags['isOptional'] === true ? '?' : ''
      return `${readString(child, 'name') ?? 'property'}${optional}: ${renderType(child['type'])}`
    })
    return properties.length > 0 ? `{ ${properties.join('; ')} }` : 'object'
  }

  return kind ?? 'unknown'
}

function normalizeFunction(declaration: JsonRecord): ReferenceSymbol {
  const name = readString(declaration, 'name')
  if (!name) throw new Error('TypeDoc function has no name')

  const signatureValue = asArray(declaration['signatures'])[0]
  const signature = asRecord(signatureValue, `${name} signature`)
  const parameters = asArray(signature['parameters']).map((parameterValue): ReferenceParameter => {
    const parameter = asRecord(parameterValue, `${name} parameter`)
    const flags =
      typeof parameter['flags'] === 'object' &&
      parameter['flags'] !== null &&
      !Array.isArray(parameter['flags'])
        ? (parameter['flags'] as JsonRecord)
        : {}
    const defaultValue = readString(parameter, 'defaultValue')
    return {
      name: readString(parameter, 'name') ?? 'parameter',
      type: renderType(parameter['type']),
      description: commentText(parameter['comment']),
      optional: flags['isOptional'] === true || defaultValue !== undefined,
      ...(defaultValue === undefined ? {} : { defaultValue }),
    }
  })
  const returns = renderType(signature['type'])
  const source = asRecord(asArray(signature['sources'])[0], `${name} source`)
  const file = readString(source, 'fileName')
  const line = source['line']
  if (!file || typeof line !== 'number') throw new Error(`${name} has no source location`)

  const parameterList = parameters
    .map((parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${parameter.type}`)
    .join(', ')

  return {
    id: `@shumoku/core.${name}`,
    name,
    kind: 'function',
    summary: commentText(signature['comment']),
    signature: `${name}(${parameterList}): ${returns}`,
    parameters,
    returns,
    source: {
      file: `libs/@shumoku/core/src/${file}`,
      line,
      url: `https://github.com/konoe-akitoshi/shumoku/blob/main/libs/@shumoku/core/src/${file}#L${line}`,
    },
  }
}

const typedoc = asRecord(JSON.parse(await readFile(typedocPath, 'utf8')), 'TypeDoc project')
const packageJson = asRecord(JSON.parse(await readFile(packagePath, 'utf8')), 'core package')
const declarations = asArray(typedoc['children']).map((child) =>
  asRecord(child, 'TypeDoc declaration'),
)
const symbols = declarations
  .filter((declaration) => declaration['kind'] === 64)
  .map(normalizeFunction)
  .sort((left, right) => left.name.localeCompare(right.name))

if (symbols.length === 0) throw new Error('TypeDoc produced no public Core functions')

const model: PackageReferenceModel = {
  schemaVersion: 1,
  package: {
    name: readString(packageJson, 'name') ?? '@shumoku/core',
    version: readString(packageJson, 'version') ?? '0.0.0',
  },
  symbols,
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${symbols.length} symbols)`,
)
