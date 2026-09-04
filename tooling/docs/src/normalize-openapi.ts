import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type JsonRecord = Record<string, unknown>

interface ApiResponse {
  status: string
  description: string
  schema?: string
}

interface ApiOperation {
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
  responses: ApiResponse[]
  source: {
    file: string
    url: string
  }
}

interface ServerReferenceModel {
  schemaVersion: 1
  api: {
    title: string
    version: string
    description: string
  }
  operations: ApiOperation[]
}

const toolingDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolingDirectory, '../../..')
const openApiPath = path.join(repositoryRoot, 'apps/server/api/openapi.json')
const outputDirectory = path.join(repositoryRoot, 'apps/docs/.generated')
const outputPath = path.join(outputDirectory, 'server.json')
const sourceFile = 'apps/server/api/openapi.json'
const sourceUrl = `https://github.com/konoe-akitoshi/shumoku/blob/main/${sourceFile}`

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

function renderSchema(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const schema = value as JsonRecord
  const reference = readString(schema, '$ref')
  if (reference) return reference.split('/').at(-1)

  const type = readString(schema, 'type')
  if (type === 'array') return `${renderSchema(schema['items']) ?? 'unknown'}[]`
  if (type === 'object') return 'object'
  if (type) return type

  for (const composition of ['oneOf', 'anyOf', 'allOf']) {
    const members = asArray(schema[composition]).map(renderSchema).filter(Boolean)
    if (members.length > 0) return members.join(composition === 'allOf' ? ' & ' : ' | ')
  }
  return undefined
}

function contentSchema(value: unknown): { contentTypes: string[]; schema: string } | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const content = value as JsonRecord
  const contentTypes = Object.keys(content)
  const firstMediaType = contentTypes[0]
  if (!firstMediaType) return undefined
  const mediaType = asRecord(content[firstMediaType], `${firstMediaType} media type`)
  return {
    contentTypes,
    schema: renderSchema(mediaType['schema']) ?? 'unknown',
  }
}

function normalizeOperation(
  method: string,
  routePath: string,
  operation: JsonRecord,
  serverPrefix: string,
): ApiOperation {
  const id = readString(operation, 'operationId')
  if (!id) throw new Error(`${method.toUpperCase()} ${routePath} has no operationId`)

  const securityNames = asArray(operation['security']).flatMap((requirementValue) => {
    const requirement = asRecord(requirementValue, `${id} security requirement`)
    return Object.keys(requirement)
  })
  const requestBodyValue = operation['requestBody']
  let requestBody: ApiOperation['requestBody']
  if (typeof requestBodyValue === 'object' && requestBodyValue !== null) {
    const body = asRecord(requestBodyValue, `${id} request body`)
    const bodyContent = contentSchema(body['content'])
    if (bodyContent) {
      requestBody = {
        required: body['required'] === true,
        ...bodyContent,
      }
    }
  }

  const responseRecord = asRecord(operation['responses'], `${id} responses`)
  const responses = Object.entries(responseRecord).map(([status, responseValue]): ApiResponse => {
    const response = asRecord(responseValue, `${id} ${status} response`)
    const responseContent = contentSchema(response['content'])
    return {
      status,
      description: readString(response, 'description') ?? '',
      ...(responseContent ? { schema: responseContent.schema } : {}),
    }
  })

  const normalizedPrefix = serverPrefix.endsWith('/') ? serverPrefix.slice(0, -1) : serverPrefix
  return {
    id,
    method: method.toUpperCase(),
    path: `${normalizedPrefix}${routePath}`,
    summary: readString(operation, 'summary') ?? id,
    tags: asArray(operation['tags']).filter((tag): tag is string => typeof tag === 'string'),
    authentication: [...new Set(securityNames)],
    ...(requestBody ? { requestBody } : {}),
    responses,
    source: { file: sourceFile, url: sourceUrl },
  }
}

const document = asRecord(JSON.parse(await readFile(openApiPath, 'utf8')), 'OpenAPI document')
const info = asRecord(document['info'], 'OpenAPI info')
const server = asArray(document['servers'])[0]
const serverPrefix = server ? (readString(asRecord(server, 'OpenAPI server'), 'url') ?? '') : ''
const paths = asRecord(document['paths'], 'OpenAPI paths')
const selectedIds = new Set(['getTopologies', 'postTopologies'])
const operations: ApiOperation[] = []

for (const [routePath, pathValue] of Object.entries(paths)) {
  const pathItem = asRecord(pathValue, `OpenAPI path ${routePath}`)
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const operationValue = pathItem[method]
    if (typeof operationValue !== 'object' || operationValue === null) continue
    const operation = asRecord(operationValue, `${method.toUpperCase()} ${routePath}`)
    const operationId = readString(operation, 'operationId')
    if (operationId && selectedIds.has(operationId)) {
      operations.push(normalizeOperation(method, routePath, operation, serverPrefix))
    }
  }
}

if (operations.length !== selectedIds.size) {
  throw new Error(
    `Expected ${selectedIds.size} selected Server operations, found ${operations.length}`,
  )
}

const model: ServerReferenceModel = {
  schemaVersion: 1,
  api: {
    title: readString(info, 'title') ?? 'Shumoku Server API',
    version: readString(info, 'version') ?? 'unknown',
    description: readString(info, 'description') ?? '',
  },
  operations,
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`)
console.log(
  `[docs] generated ${path.relative(repositoryRoot, outputPath)} (${operations.length} operations)`,
)
