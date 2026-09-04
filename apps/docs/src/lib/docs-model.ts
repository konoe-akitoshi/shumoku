import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface ReferenceParameter {
  name: string
  type: string
  description: string
  optional: boolean
  defaultValue?: string
}

export interface ReferenceSymbol {
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

export interface PackageReferenceModel {
  schemaVersion: 1
  package: {
    name: string
    version: string
  }
  symbols: ReferenceSymbol[]
}

export interface ApiOperation {
  id: string
  method: string
  path: string
  summary: string
  tags: string[]
  authentication: string[]
  requestBody?: {
    required: boolean
    contentTypes: string[]
    schema: string
  }
  responses: Array<{
    status: string
    description: string
    schema?: string
  }>
  source: {
    file: string
    url: string
  }
}

export interface ServerReferenceModel {
  schemaVersion: 1
  api: {
    title: string
    version: string
    description: string
  }
  operations: ApiOperation[]
}

export interface CliOption {
  name: string
  short?: string
  type: 'string' | 'boolean'
  valueName?: string
  description: string
  defaultValue?: string | boolean
  choices?: string[]
  group: 'output' | 'other'
}

export interface CliCommand {
  name: string
  summary: string
  usage: string
  input: { name: string; description: string[] }
  options: CliOption[]
  examples: string[]
}

export interface CliReferenceModel {
  schemaVersion: 1
  package: { name: string; version: string }
  commands: CliCommand[]
  source: { file: string; url: string }
}

export interface YamlReferenceModel {
  schemaVersion: 1
  title: string
  sections: Array<{
    id: string
    title: string
    fields: Array<{
      name: string
      type: string
      description: string
      required: boolean
      values?: string[]
    }>
  }>
  example: { file: string; contents: string }
  source: { file: string; url: string }
}

export interface PluginField {
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

export interface PluginReference {
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

export interface PluginsReferenceModel {
  schemaVersion: 1
  plugins: PluginReference[]
}

export type ServerDocsChannel = 'development' | 'beta' | 'stable'

export interface ServerGuideArtifact {
  id: string
  title: string
  description: string
  locale: 'en' | 'ja'
  canonicalLocale: 'en' | 'ja'
  slug: string
  status: string
  audience: string
  owner: string
  related: string[]
  file: string
  body: string
}

export type RepositoryDocumentOwner = 'project' | 'library' | 'cli' | 'server'

export interface RepositoryDocument {
  id: string
  owner: RepositoryDocumentOwner
  title: string
  description: string
  locale: 'en' | 'ja'
  route: string
  file: string
  manifest: string
  body: string
}

export interface RepositoryDocsModel {
  schemaVersion: 1
  sourceCommit: string
  documents: RepositoryDocument[]
}

export interface ServerDocsArtifact {
  schemaVersion: 1
  product: 'server'
  release: {
    version: string
    productVersion: string
    channel: ServerDocsChannel
    tag: string | null
    sourceCommit: string
  }
  references: {
    api: ServerReferenceModel
    plugins: PluginsReferenceModel
  }
  guides: ServerGuideArtifact[]
  documents: RepositoryDocument[]
  integrity: {
    algorithm: 'sha256'
    inputs: Record<string, string>
    contentDigest: string
  }
}

export interface ServerVersionsModel {
  schemaVersion: 1
  aliases: {
    latest?: string
    beta?: string
    next?: string
  }
  versions: ServerDocsArtifact[]
}

function isPackageReferenceModel(value: unknown): value is PackageReferenceModel {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const model = value as Record<string, unknown>
  if (model['schemaVersion'] !== 1 || !Array.isArray(model['symbols'])) return false

  const packageValue = model['package']
  if (typeof packageValue !== 'object' || packageValue === null || Array.isArray(packageValue)) {
    return false
  }
  const packageRecord = packageValue as Record<string, unknown>
  if (typeof packageRecord['name'] !== 'string' || typeof packageRecord['version'] !== 'string') {
    return false
  }

  return model['symbols'].every((symbolValue) => {
    if (typeof symbolValue !== 'object' || symbolValue === null || Array.isArray(symbolValue)) {
      return false
    }
    const symbol = symbolValue as Record<string, unknown>
    return (
      typeof symbol['id'] === 'string' &&
      typeof symbol['name'] === 'string' &&
      symbol['kind'] === 'function' &&
      typeof symbol['summary'] === 'string' &&
      typeof symbol['signature'] === 'string' &&
      Array.isArray(symbol['parameters']) &&
      typeof symbol['returns'] === 'string'
    )
  })
}

export async function loadCoreReference(): Promise<PackageReferenceModel> {
  const modelPath = path.resolve('.generated/core.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (!isPackageReferenceModel(model)) {
    throw new Error(`Invalid generated Core reference model at ${modelPath}`)
  }
  return model
}

function isServerReferenceModel(value: unknown): value is ServerReferenceModel {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const model = value as Record<string, unknown>
  if (model['schemaVersion'] !== 1 || !Array.isArray(model['operations'])) return false
  if (typeof model['api'] !== 'object' || model['api'] === null || Array.isArray(model['api'])) {
    return false
  }
  const api = model['api'] as Record<string, unknown>
  if (typeof api['title'] !== 'string' || typeof api['version'] !== 'string') return false

  return model['operations'].every((operationValue) => {
    if (
      typeof operationValue !== 'object' ||
      operationValue === null ||
      Array.isArray(operationValue)
    ) {
      return false
    }
    const operation = operationValue as Record<string, unknown>
    return (
      typeof operation['id'] === 'string' &&
      typeof operation['method'] === 'string' &&
      typeof operation['path'] === 'string' &&
      typeof operation['summary'] === 'string' &&
      Array.isArray(operation['authentication']) &&
      Array.isArray(operation['responses'])
    )
  })
}

export async function loadServerReference(): Promise<ServerReferenceModel> {
  const modelPath = path.resolve('.generated/server.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (!isServerReferenceModel(model)) {
    throw new Error(`Invalid generated Server reference model at ${modelPath}`)
  }
  return model
}

export async function loadCliReference(): Promise<CliReferenceModel> {
  const modelPath = path.resolve('.generated/cli.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    throw new Error(`Invalid generated CLI reference model at ${modelPath}`)
  }
  const record = model as Record<string, unknown>
  if (record['schemaVersion'] !== 1 || !Array.isArray(record['commands'])) {
    throw new Error(`Invalid generated CLI reference model at ${modelPath}`)
  }
  return model as CliReferenceModel
}

export async function loadYamlReference(): Promise<YamlReferenceModel> {
  const modelPath = path.resolve('.generated/yaml.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    throw new Error(`Invalid generated YAML reference model at ${modelPath}`)
  }
  const record = model as Record<string, unknown>
  if (record['schemaVersion'] !== 1 || !Array.isArray(record['sections'])) {
    throw new Error(`Invalid generated YAML reference model at ${modelPath}`)
  }
  return model as YamlReferenceModel
}

export async function loadPluginsReference(): Promise<PluginsReferenceModel> {
  const modelPath = path.resolve('.generated/plugins.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    throw new Error(`Invalid generated Plugins reference model at ${modelPath}`)
  }
  const record = model as Record<string, unknown>
  if (record['schemaVersion'] !== 1 || !Array.isArray(record['plugins'])) {
    throw new Error(`Invalid generated Plugins reference model at ${modelPath}`)
  }
  return model as PluginsReferenceModel
}

export async function loadRepositoryDocs(): Promise<RepositoryDocsModel> {
  const modelPath = path.resolve('.generated/repository-docs.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    throw new Error(`Invalid generated repository documents model at ${modelPath}`)
  }
  const record = model as Record<string, unknown>
  if (
    record['schemaVersion'] !== 1 ||
    typeof record['sourceCommit'] !== 'string' ||
    !Array.isArray(record['documents'])
  ) {
    throw new Error(`Invalid generated repository documents model at ${modelPath}`)
  }
  return model as RepositoryDocsModel
}

export async function loadServerVersions(): Promise<ServerVersionsModel> {
  const modelPath = path.resolve('.generated/server-versions.json')
  const model: unknown = JSON.parse(await readFile(modelPath, 'utf8'))
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    throw new Error(`Invalid generated Server versions model at ${modelPath}`)
  }
  const record = model as Record<string, unknown>
  if (
    record['schemaVersion'] !== 1 ||
    typeof record['aliases'] !== 'object' ||
    record['aliases'] === null ||
    !Array.isArray(record['versions'])
  ) {
    throw new Error(`Invalid generated Server versions model at ${modelPath}`)
  }
  return model as ServerVersionsModel
}
