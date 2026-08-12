import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript'
import type { AppServices } from '../api/src/app/services.js'
import { createOpenApiDocument } from '../api/src/openapi/document.js'

const serverRoot = resolve(import.meta.dir, '..')
const documentPath = resolve(serverRoot, 'api/openapi.json')
const typesPath = resolve(serverRoot, 'web/src/lib/api.generated.ts')
const generatedHeader = `// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

`

const services: AppServices = {
  system: {
    getBuildInfo: () => ({
      version: '0.0.0-development',
      channel: 'development',
      deployment: 'source',
    }),
    getSystemInfo: async () => ({
      build: {
        version: '0.0.0-development',
        channel: 'development',
        deployment: 'source',
      },
      update: { status: 'disabled', currentVersion: '0.0.0-development' },
    }),
  },
  admin: {
    getStatus: () => ({
      status: 'ok',
      timestamp: 0,
      uptimeSeconds: 0,
      database: { ready: true },
      topologies: { database: 0, legacyFile: 0 },
      plugins: { registered: 0 },
      realtime: { webSocketClients: 0, sseSubscribers: 0 },
      schedulers: {
        metrics: {
          running: false,
          activePolls: 0,
          queuedPolls: 0,
          topologyCount: 0,
          watchedTopologies: 0,
          inFlightTopologies: 0,
          fastIntervalMs: 0,
          slowIntervalMs: 0,
          concurrencyLimit: 0,
        },
        discovery: {
          running: false,
          tickInFlight: false,
          tickIntervalMs: 0,
          minimumSyncIntervalMs: 0,
        },
      },
    }),
  },
  dataSources: {
    list: () => [],
    get: () => null,
    create: async () => {
      throw new Error('Contract generation does not execute handlers')
    },
    update: async () => null,
    delete: () => false,
  },
  topologies: {
    list: () => [],
    get: () => null,
    create: async () => {
      throw new Error('Contract generation does not execute handlers')
    },
    update: async () => null,
    delete: () => false,
  },
}

async function generateArtifacts(): Promise<Map<string, string>> {
  const document = createOpenApiDocument(services, {
    version: '0.0.0-development',
    serverUrl: '/api',
    serverDescription: 'Same-origin Shumoku Server API',
  })
  const json = `${JSON.stringify(document, null, 2)}\n`
  const ast = await openapiTS(document as unknown as OpenAPI3)
  const types = `${generatedHeader}${astToString(ast)}`
  return new Map([
    [documentPath, json],
    [typesPath, types],
  ])
}

async function checkArtifacts(artifacts: Map<string, string>): Promise<void> {
  const stale: string[] = []
  for (const [path, expected] of artifacts) {
    const actual = await readFile(path, 'utf8').catch(() => '')
    if (actual !== expected) stale.push(path)
  }
  if (stale.length === 0) return

  console.error('OpenAPI artifacts are stale:')
  for (const path of stale) console.error(`- ${path}`)
  console.error('Run: bun run openapi:generate')
  process.exitCode = 1
}

const artifacts = await generateArtifacts()
if (process.argv.includes('--check')) {
  await checkArtifacts(artifacts)
} else {
  for (const [path, contents] of artifacts) await Bun.write(path, contents)
  console.log(`Generated ${documentPath}`)
  console.log(`Generated ${typesPath}`)
}
