import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type JsonRecord = Record<string, unknown>

interface PluginField {
  name: string
  type: string
  title: string
  required: boolean
  secret: boolean
  defaultValue?: string
  help?: string
  warning?: string
  choices?: string[]
}

interface PluginReference {
  type: string
  displayName: string
  description: string
  version?: string
  capabilities: string[]
  webhook: boolean
  config: PluginField[]
  options: PluginField[]
  source: { file: string; url: string }
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const outputPath = path.join(repositoryRoot, 'apps/docs/.generated/plugins.json')

function asRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`)
  }
  return value as JsonRecord
}

function readString(record: JsonRecord, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined
}

function renderValue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function normalizeSchema(value: unknown, context: string): PluginField[] {
  if (value === undefined) return []
  const schema = asRecord(value, context)
  const properties = asRecord(schema['properties'], `${context}.properties`)
  const required = new Set(
    Array.isArray(schema['required'])
      ? schema['required'].filter((item): item is string => typeof item === 'string')
      : [],
  )
  const fields: PluginField[] = []

  function visit(
    prefix: string,
    propertyName: string,
    propertyValue: unknown,
    isRequired: boolean,
  ) {
    const property = asRecord(propertyValue, `${context}.${propertyName}`)
    const name = prefix ? `${prefix}.${propertyName}` : propertyName
    const type = readString(property, 'type') ?? 'unknown'
    const oneOf = Array.isArray(property['oneOf']) ? property['oneOf'] : []
    const enumValues = Array.isArray(property['enum']) ? property['enum'] : []
    const choices = [
      ...oneOf.map((choice) => {
        const option = asRecord(choice, `${context}.${name}.oneOf`)
        const optionValue = renderValue(option['const']) ?? ''
        const optionTitle = readString(option, 'title')
        return optionTitle ? `${optionValue} — ${optionTitle}` : optionValue
      }),
      ...enumValues.map((choice) => renderValue(choice) ?? ''),
    ].filter(Boolean)
    fields.push({
      name,
      type: type === 'array' ? 'string[]' : type,
      title: readString(property, 'title') ?? name,
      required: isRequired,
      secret: property['secret'] === true || property['format'] === 'password',
      ...(renderValue(property['default']) === undefined
        ? {}
        : { defaultValue: renderValue(property['default']) }),
      ...(readString(property, 'help') ? { help: readString(property, 'help') } : {}),
      ...(readString(property, 'warning') ? { warning: readString(property, 'warning') } : {}),
      ...(choices.length > 0 ? { choices } : {}),
    })
    if (type === 'object' && property['properties']) {
      const nestedRequired = new Set(
        Array.isArray(property['required'])
          ? property['required'].filter((item): item is string => typeof item === 'string')
          : [],
      )
      for (const [childName, child] of Object.entries(
        asRecord(property['properties'], `${context}.${name}.properties`),
      )) {
        visit(name, childName, child, nestedRequired.has(childName))
      }
    }
  }

  for (const [name, property] of Object.entries(properties)) {
    visit('', name, property, required.has(name))
  }
  return fields
}

async function pluginSources(): Promise<string[]> {
  const pluginsRoot = path.join(repositoryRoot, 'libs/plugins')
  const directories = await readdir(pluginsRoot, { withFileTypes: true })
  const sources = directories
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(pluginsRoot, entry.name, 'src/index.ts'))
  sources.push(path.join(repositoryRoot, 'apps/server/api/src/plugins/manual-plugin.ts'))
  return sources.sort()
}

const plugins: PluginReference[] = []
for (const sourcePath of await pluginSources()) {
  const source = path.relative(repositoryRoot, sourcePath)
  const module = (await import(pathToFileURL(sourcePath).href)) as Record<string, unknown>
  const registerValue = module['register'] ?? module['registerManualPlugin']
  if (typeof registerValue !== 'function') throw new Error(`${source}: no plugin register function`)

  let descriptorValue: unknown
  const registry = {
    registerDescriptor(descriptor: unknown) {
      descriptorValue = descriptor
    },
    register(type: string, displayName: string, capabilities: string[]) {
      descriptorValue = { type, displayName, capabilities }
    },
  }
  registerValue(registry)
  const descriptor = asRecord(descriptorValue, `${source} descriptor`)
  const type = readString(descriptor, 'type')
  const displayName = readString(descriptor, 'displayName')
  if (!type || !displayName || !Array.isArray(descriptor['capabilities'])) {
    throw new Error(`${source}: invalid plugin descriptor`)
  }
  const packagePath = source.startsWith('libs/plugins/')
    ? path.join(repositoryRoot, source.split('/src/')[0] ?? '', 'package.json')
    : undefined
  const packageValue = packagePath
    ? asRecord(JSON.parse(await readFile(packagePath, 'utf8')), `${source} package`)
    : undefined
  plugins.push({
    type,
    displayName,
    description: readString(descriptor, 'description') ?? '',
    ...((readString(descriptor, 'version') ?? readString(packageValue ?? {}, 'version'))
      ? { version: readString(descriptor, 'version') ?? readString(packageValue ?? {}, 'version') }
      : {}),
    capabilities: descriptor['capabilities'].filter(
      (capability): capability is string => typeof capability === 'string',
    ),
    webhook: descriptor['webhook'] === true,
    config: normalizeSchema(descriptor['configSchema'], `${type}.configSchema`),
    options: normalizeSchema(descriptor['optionsSchema'], `${type}.optionsSchema`),
    source: {
      file: source,
      url: `https://github.com/konoe-akitoshi/shumoku/blob/main/${source}`,
    },
  })
}
plugins.sort((left, right) => left.displayName.localeCompare(right.displayName))

await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, plugins }, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${plugins.length} plugins)`,
)
