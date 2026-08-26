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
  auth: {
    isSetupComplete: () => true,
    getSessionPrincipal: () => null,
    setPassword: async () => undefined,
    setInitialPassword: async () => false,
    verifyPassword: async () => false,
    createSession: () => 'not-executed',
    deleteSession: () => undefined,
    deleteAllSessions: () => undefined,
    checkRateLimit: () => 0,
    recordFailedAttempt: () => undefined,
    clearAttempts: () => undefined,
  },
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
      topologies: { total: 0 },
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
    crud: {
      list: () => [],
      get: () => null,
      create: async () => {
        throw new Error('Contract generation does not execute handlers')
      },
      update: async () => null,
      delete: () => false,
    },
    operations: {
      listByCapability: () => [],
      listPluginTypes: () => [],
      getConfigOptions: async () => null,
      getConnectionInfo: () => [],
      listAttachedTopologies: () => null,
      testConnection: async () => ({ success: false, message: 'Not executed' }),
      getHosts: async () => [],
      getHostItems: async () => [],
      getInterfaceNeighbors: async () => [],
      discoverMetrics: async () => [],
      getFilterOptions: async () => null,
      getAlerts: async () => null,
      callNative: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    },
    scan: {
      scan: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    },
  },
  dashboards: {
    list: () => [],
    get: () => null,
    create: async () => {
      throw new Error('Contract generation does not execute handlers')
    },
    update: () => null,
    delete: () => false,
    share: async () => null,
    unshare: () => false,
  },
  plugins: {
    list: () => [],
    getManifest: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    installFromPath: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    installFromUrl: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    installFromZip: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    setEnabled: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    remove: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    reload: async () => ({ ok: false, status: 500, error: 'Not executed' }),
  },
  observations: {
    list: () => [],
    get: () => null,
    latest: () => null,
    record: async () => {
      throw new Error('Contract generation does not execute handlers')
    },
    resolved: async () => null,
    getDisplaySettings: () => ({
      edgeStyle: 'orthogonal',
      splineMode: 'sloppy',
      hideDisconnected: false,
    }),
    updateDisplaySettings: async () => ({ ok: true }),
  },
  topologySources: {
    list: () => ({ ok: true, value: [] }),
    add: async () => ({ ok: false, status: 500, error: 'Not executed' }),
    update: () => ({ ok: false, status: 404, error: 'Not executed' }),
    remove: () => ({ ok: false, status: 404, error: 'Not executed' }),
    clear: () => ({ ok: false, status: 404, error: 'Not executed' }),
    replace: async () => ({ ok: true, value: [] }),
    probe: async () => ({ ok: false, status: 500, error: 'Not executed' }),
    sync: async () => ({ ok: false, status: 500, error: 'Not executed' }),
  },
  topologyQueries: {
    parsed: async () => ({ kind: 'error', status: 404, error: 'Not executed' }),
    graph: async () => ({ kind: 'error', status: 404, error: 'Not executed' }),
    serializedView: async () => ({ kind: 'error', status: 404, error: 'Not executed' }),
    render: async () => ({ kind: 'error', status: 404, error: 'Not executed' }),
    context: async () => ({ kind: 'error', status: 404, error: 'Not executed' }),
    getComposition: () => ({ kind: 'error', status: 404, error: 'Not executed' }),
    updateComposition: () => ({ kind: 'error', status: 404, error: 'Not executed' }),
  },
  topologyMappings: {
    get: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    listSources: async () => ({ ok: true, value: [] }),
    listOrphans: async () => ({ ok: true, value: { orphans: [] } }),
    reassignOrphan: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    discardOrphan: () => ({ ok: false, status: 404, error: 'Not executed' }),
    resetRegistry: () => ({ ok: false, status: 404, error: 'Not executed' }),
    replace: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    patchNode: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    patchLink: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    clear: () => ({ ok: true, value: { deleted: 0 } }),
    autoMapLinks: async () => ({ ok: true, value: { matched: 0, total: 0, skipped: 0 } }),
  },
  topologySync: {
    start: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    getJob: () => ({ ok: true, value: { job: null } }),
    cancel: () => ({ ok: true, value: { job: null } }),
    share: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    unshare: () => ({ ok: false, status: 404, error: 'Not executed' }),
  },
  discoveryPolicy: {
    getTopology: () => null,
    getParsedGraph: async () => null,
    clearCache: () => undefined,
    readOverlay: () => null,
    writeOverlay: async () => undefined,
    listConfigs: () => new Map(),
    bulkSetConfig: () => undefined,
    upsertConfig: () => null,
  },
  share: {
    topology: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    dashboard: () => ({ ok: false, status: 404, error: 'Not executed' }),
    dashboardTopology: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    dashboardAlerts: async () => ({ ok: false, status: 404, error: 'Not executed' }),
    topologyStreamId: () => null,
    dashboardTopologyStreamId: () => null,
    liveSubscriberCount: () => 0,
    latestMetrics: () => null,
    subscribeMetrics: () => () => undefined,
    servedRevision: () => 0,
    mappingVersion: () => 0,
  },
  webhooks: {
    handle: async () => ({ ok: false, status: 404, error: 'Not executed' }),
  },
  settings: {
    list: () => ({}),
    get: () => null,
    setMany: () => undefined,
    set: () => undefined,
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
