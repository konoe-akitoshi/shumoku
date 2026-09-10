import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { yamlNetworkSchema } from '../../../libs/@shumoku/core/src/parser/parser.js'

type JsonRecord = Record<string, unknown>

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const outputPath = path.join(repositoryRoot, 'apps/docs/.generated/yaml.json')
const exampleFile = 'examples/getting-started.yaml'
const schemaFile = 'libs/@shumoku/core/src/parser/parser.ts'

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
  return typeof record[key] === 'string' ? record[key] : undefined
}

function renderType(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'any'
  const schema = value as JsonRecord
  const variants = [...asArray(schema['anyOf']), ...asArray(schema['oneOf'])]
  if (variants.length > 0) return variants.map(renderType).join(' | ')
  const type = readString(schema, 'type')
  if (type === 'array') return `${renderType(schema['items'])}[]`
  return type ?? 'any'
}

function schemaSection(id: string, title: string, value: unknown) {
  const schema = asRecord(value, `${id} schema`)
  const properties = asRecord(schema['properties'], `${id} properties`)
  const required = new Set(
    asArray(schema['required']).filter((item): item is string => typeof item === 'string'),
  )
  return {
    id,
    title,
    fields: Object.entries(properties).map(([name, fieldValue]) => {
      const field = asRecord(fieldValue, `${id}.${name}`)
      const enumValues = asArray(field['enum']).filter(
        (item): item is string => typeof item === 'string',
      )
      return {
        name,
        type: renderType(field),
        description: readString(field, 'description') ?? '',
        required: required.has(name),
        ...(enumValues.length > 0 ? { values: enumValues } : {}),
      }
    }),
  }
}

const jsonSchema = asRecord(
  z.toJSONSchema(yamlNetworkSchema, { unrepresentable: 'any' }),
  'YAML JSON Schema',
)
const topLevelProperties = asRecord(jsonSchema['properties'], 'YAML properties')
const nodes = asRecord(topLevelProperties['nodes'], 'nodes schema')
const links = asRecord(topLevelProperties['links'], 'links schema')

const model = {
  schemaVersion: 1,
  title: 'Shumoku YAML',
  sections: [
    schemaSection('document', 'Document', jsonSchema),
    schemaSection('node', 'Node', asRecord(nodes['items'], 'node item schema')),
    schemaSection('link', 'Link', asRecord(links['items'], 'link item schema')),
    schemaSection('settings', 'Settings', topLevelProperties['settings']),
  ],
  example: {
    file: exampleFile,
    contents: await readFile(path.join(repositoryRoot, exampleFile), 'utf8'),
  },
  source: {
    file: schemaFile,
    url: `https://github.com/konoe-akitoshi/shumoku/blob/main/${schemaFile}`,
  },
}

await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${model.sections.length} sections)`,
)
