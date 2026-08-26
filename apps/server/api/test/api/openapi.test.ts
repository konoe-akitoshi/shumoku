// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { AppServices } from '../../src/app/services.js'
import { getDatabase } from '../../src/db/index.js'
import { createOpenApiDocument } from '../../src/openapi/document.js'
import { createApiRouter } from '../../src/openapi/router.js'
import { TopologyService } from '../../src/services/topology.js'
import type { Dashboard, DataSource } from '../../src/types.js'
import { setupTempDb, type TempDb } from '../db/helper.js'

const DEV_TOKEN = 'a'.repeat(64)
let database: TempDb
let originalNodeEnv: string | undefined
let originalHost: string | undefined
let originalDevToken: string | undefined
let topologyService: TopologyService
const dataSources = new Map<string, DataSource>()
const dashboards = new Map<string, Dashboard>()
const settings = new Map<string, string>()

const services: AppServices = {
  auth: {
    isSetupComplete: () => true,
    getSessionPrincipal: () => null,
    setPassword: async () => undefined,
    setInitialPassword: async () => false,
    verifyPassword: async () => false,
    createSession: () => 'test-session',
    deleteSession: () => undefined,
    deleteAllSessions: () => undefined,
    checkRateLimit: () => 0,
    recordFailedAttempt: () => undefined,
    clearAttempts: () => undefined,
  },
  system: {
    getBuildInfo: () => ({
      version: 'test',
      channel: 'development',
      deployment: 'source',
    }),
    getSystemInfo: async () => ({
      build: { version: 'test', channel: 'development', deployment: 'source' },
      update: { status: 'disabled', currentVersion: 'test' },
    }),
  },
  admin: {
    getStatus: () => ({
      status: 'ok',
      timestamp: Date.now(),
      uptimeSeconds: 1,
      database: { ready: true },
      topologies: { total: 0 },
      plugins: { registered: 0 },
      realtime: { webSocketClients: 0, sseSubscribers: 0 },
      schedulers: {
        metrics: {
          running: true,
          activePolls: 0,
          queuedPolls: 0,
          topologyCount: 0,
          watchedTopologies: 0,
          inFlightTopologies: 0,
          fastIntervalMs: 5000,
          slowIntervalMs: 60_000,
          concurrencyLimit: 3,
        },
        discovery: {
          running: true,
          tickInFlight: false,
          tickIntervalMs: 60_000,
          minimumSyncIntervalMs: 300_000,
        },
      },
    }),
  },
  dataSources: {
    crud: {
      list: () => [...dataSources.values()],
      get: (id) => dataSources.get(id) ?? null,
      create: async (input) => {
        const dataSource: DataSource = {
          id: `source-${dataSources.size + 1}`,
          ...input,
          status: 'unknown',
          failCount: 0,
          createdAt: 1,
          updatedAt: 1,
        }
        dataSources.set(dataSource.id, dataSource)
        return dataSource
      },
      update: async (id, input) => {
        const current = dataSources.get(id)
        if (!current) return null
        const updated = { ...current, ...input, updatedAt: 2 }
        dataSources.set(id, updated)
        return updated
      },
      delete: (id) => dataSources.delete(id),
    },
    operations: {
      listByCapability: () => [...dataSources.values()],
      listPluginTypes: () => [],
      getConfigOptions: async (id) => (dataSources.has(id) ? [] : null),
      getConnectionInfo: () => [],
      listAttachedTopologies: (id) => (dataSources.has(id) ? [] : null),
      testConnection: async (id) => ({
        success: dataSources.has(id),
        message: dataSources.has(id) ? 'Connected' : 'Data source not found',
      }),
      getHosts: async () => [],
      getHostItems: async () => [],
      getInterfaceNeighbors: async () => [],
      discoverMetrics: async () => [],
      getFilterOptions: async () => null,
      getAlerts: async () => null,
      callNative: async () => ({ ok: false, status: 404, error: 'Not available' }),
    },
    scan: {
      scan: async () => ({ ok: false, status: 404, error: 'Not available' }),
    },
  },
  plugins: {
    list: () => [],
    getManifest: async () => ({ ok: false, status: 404, error: 'Not found' }),
    installFromPath: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    installFromUrl: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    installFromZip: async () => ({ ok: false, status: 400, error: 'Not executed' }),
    setEnabled: async () => ({ ok: true, value: { success: true } }),
    remove: async () => ({ ok: true, value: { success: true } }),
    reload: async () => ({ ok: true, value: { success: true, plugins: [], count: 0 } }),
  },
  observations: {
    list: () => [],
    get: () => null,
    latest: () => null,
    record: async () => {
      throw new Error('Not executed')
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
    parsed: async () => ({ kind: 'error', status: 404, error: 'Not found' }),
    graph: async () => ({ kind: 'error', status: 404, error: 'Not found' }),
    serializedView: async () => ({ kind: 'error', status: 404, error: 'Not found' }),
    render: async () => ({ kind: 'error', status: 404, error: 'Not found' }),
    context: async () => ({ kind: 'error', status: 404, error: 'Not found' }),
    getComposition: () => ({ kind: 'error', status: 404, error: 'Not found' }),
    updateComposition: () => ({ kind: 'error', status: 404, error: 'Not found' }),
  },
  topologyMappings: {
    get: async () => ({ ok: false, status: 404, error: 'Not found' }),
    listSources: async () => ({ ok: true, value: [] }),
    listOrphans: async () => ({ ok: true, value: { orphans: [] } }),
    reassignOrphan: async () => ({ ok: false, status: 404, error: 'Not found' }),
    discardOrphan: () => ({ ok: false, status: 404, error: 'Not found' }),
    resetRegistry: () => ({ ok: false, status: 404, error: 'Not found' }),
    replace: async () => ({ ok: false, status: 404, error: 'Not found' }),
    patchNode: async () => ({ ok: false, status: 404, error: 'Not found' }),
    patchLink: async () => ({ ok: false, status: 404, error: 'Not found' }),
    clear: () => ({ ok: true, value: { deleted: 0 } }),
    autoMapLinks: async () => ({ ok: true, value: { matched: 0, total: 0, skipped: 0 } }),
  },
  topologySync: {
    start: async () => ({ ok: false, status: 404, error: 'Not found' }),
    getJob: () => ({ ok: true, value: { job: null } }),
    cancel: () => ({ ok: true, value: { job: null } }),
    share: async () => ({ ok: false, status: 404, error: 'Not found' }),
    unshare: () => ({ ok: false, status: 404, error: 'Not found' }),
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
    topology: async () => ({ ok: false, status: 404, error: 'Not found' }),
    dashboard: () => ({ ok: false, status: 404, error: 'Not found' }),
    dashboardTopology: async () => ({ ok: false, status: 404, error: 'Not found' }),
    dashboardAlerts: async () => ({ ok: false, status: 404, error: 'Not found' }),
    topologyStreamId: () => null,
    dashboardTopologyStreamId: () => null,
    liveSubscriberCount: () => 0,
    latestMetrics: () => null,
    subscribeMetrics: () => () => undefined,
    servedRevision: () => 0,
    mappingVersion: () => 0,
  },
  webhooks: {
    handle: async () => ({ ok: false, status: 404, error: 'Not found' }),
  },
  dashboards: {
    list: () => [...dashboards.values()],
    get: (id) => dashboards.get(id) ?? null,
    create: async (input) => {
      const dashboard = {
        id: `dashboard-${dashboards.size + 1}`,
        name: input.name,
        layoutJson: input.layoutJson ?? '{}',
        createdAt: 1,
        updatedAt: 1,
      }
      dashboards.set(dashboard.id, dashboard)
      return dashboard
    },
    update: (id, input) => {
      const current = dashboards.get(id)
      if (!current) return null
      const updated = { ...current, ...input, updatedAt: 2 }
      dashboards.set(id, updated)
      return updated
    },
    delete: (id) => dashboards.delete(id),
    share: async (id) => (dashboards.has(id) ? 'share-token' : null),
    unshare: (id) => dashboards.has(id),
  },
  settings: {
    list: () => Object.fromEntries(settings),
    get: (key) => settings.get(key) ?? null,
    setMany: (values) => {
      for (const [key, value] of Object.entries(values)) settings.set(key, value)
    },
    set: (key, value) => settings.set(key, value),
    delete: (key) => settings.delete(key),
  },
  topologies: {
    list: () => topologyService.list(),
    get: (id) => topologyService.get(id),
    create: (input) => topologyService.create(input),
    update: (id, input) => topologyService.update(id, input),
    delete: (id) => topologyService.delete(id),
  },
}

beforeAll(() => {
  database = setupTempDb()
  getDatabase()
    .prepare("INSERT INTO settings (key, value) VALUES ('auth_password_hash', 'configured')")
    .run()
  originalNodeEnv = process.env['NODE_ENV']
  originalHost = process.env['HOST']
  originalDevToken = process.env['SHUMOKU_DEV_API_TOKEN']
  process.env['NODE_ENV'] = 'development'
  process.env['HOST'] = '127.0.0.1'
  process.env['SHUMOKU_DEV_API_TOKEN'] = DEV_TOKEN
  topologyService = new TopologyService()
})

afterAll(() => {
  if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
  else process.env['NODE_ENV'] = originalNodeEnv
  if (originalHost === undefined) delete process.env['HOST']
  else process.env['HOST'] = originalHost
  if (originalDevToken === undefined) delete process.env['SHUMOKU_DEV_API_TOKEN']
  else process.env['SHUMOKU_DEV_API_TOKEN'] = originalDevToken
  database.teardown()
})

function createApp(): Hono {
  const app = new Hono()
  app.route('/api', createApiRouter(services))
  return app
}

const openApiMethods = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const

function operationKey(method: string, path: string): string {
  const contractPath = path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
  return `${method.toUpperCase()} ${contractPath}`
}

function isInfrastructurePath(path: string): boolean {
  return path === '/runtime.js' || path === '/openapi.json'
}

describe('OpenAPI root integration', () => {
  test('keeps every HTTP API route in the generated contract', () => {
    const router = createApiRouter(services)
    const runtimeOperations = new Set(
      router.routes
        .filter((route) => route.method !== 'ALL' && !isInfrastructurePath(route.path))
        .map((route) => operationKey(route.method, route.path)),
    )
    const document = createOpenApiDocument(services, {
      version: 'test',
      serverUrl: '/api',
    })
    const contractOperations = new Set<string>()
    const operationIds: string[] = []
    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const method of openApiMethods) {
        if (!pathItem || !(method in pathItem)) continue
        contractOperations.add(operationKey(method, path))
        const operation = pathItem[method]
        expect(operation?.operationId).toEqual(expect.any(String))
        if (operation?.operationId) operationIds.push(operation.operationId)
      }
    }

    const missingAtRuntime = [...contractOperations]
      .filter((operation) => !runtimeOperations.has(operation))
      .sort()
    const undocumented = [...runtimeOperations]
      .filter((operation) => !contractOperations.has(operation))
      .sort()

    expect(missingAtRuntime).toEqual([])
    expect(undocumented).toEqual([])
    expect(new Set(operationIds).size).toBe(operationIds.length)
    expect(document.paths['/topologies/{id}']?.get?.operationId).toBe('getTopologiesById')
  })

  test('keeps health public and protects diagnostics after setup', async () => {
    const app = createApp()

    expect((await app.request('/api/health')).status).toBe(200)
    const unauthorized = await app.request('/api/admin/status')
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get('X-Request-ID')).toEqual(expect.any(String))
    expect(await unauthorized.json()).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      error: 'Authentication required',
      requestId: expect.any(String),
    })
    expect((await app.request('/api/openapi.json')).status).toBe(401)
  })

  test('serves admin status and the generated contract to dev automation', async () => {
    const app = createApp()
    const headers = { Authorization: `Bearer ${DEV_TOKEN}` }

    expect((await app.request('/api/admin/status', { headers })).status).toBe(200)
    const response = await app.request('/api/openapi.json', { headers })
    const document = await response.json()

    expect(response.status).toBe(200)
    expect(document.openapi).toBe('3.1.0')
    expect(document.paths['/health']?.get).toBeDefined()
    expect(document.paths['/system']?.get).toBeDefined()
    expect(document.paths['/admin/status']?.get).toBeDefined()
    expect(document.paths['/datasources']?.get).toBeDefined()
    expect(document.paths['/datasources']?.post).toBeDefined()
    expect(document.paths['/datasources/{id}']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}']?.put).toBeDefined()
    expect(document.paths['/datasources/{id}']?.delete).toBeDefined()
    expect(document.paths['/datasources/types']?.get).toBeDefined()
    expect(document.paths['/datasources/by-capability/{capability}']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/config-options/{key}']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/connection-info']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/topologies']?.get).toBeDefined()
    expect(document.paths['/datasources/{id}/test']?.post).toBeDefined()
    expect(document.paths['/topologies']?.get).toBeDefined()
    expect(document.paths['/topologies']?.post).toBeDefined()
    expect(document.paths['/topologies/{id}']?.get).toBeDefined()
    expect(document.paths['/topologies/{id}']?.put).toBeDefined()
    expect(document.paths['/topologies/{id}']?.delete).toBeDefined()
  })

  test('supports authenticated topology CRUD through the generated contract', async () => {
    const app = createApp()
    const headers = {
      Authorization: `Bearer ${DEV_TOKEN}`,
      'Content-Type': 'application/json',
    }

    const createResponse = await app.request('/api/topologies', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Automation Lab' }),
    })
    const created = (await createResponse.json()) as { id: string; name: string }
    expect(createResponse.status).toBe(201)
    expect(created.name).toBe('Automation Lab')

    const updateResponse = await app.request(`/api/topologies/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Automation Lab Updated' }),
    })
    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({ name: 'Automation Lab Updated' })

    const listResponse = await app.request('/api/topologies', { headers })
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toEqual([
      expect.objectContaining({ id: created.id, name: 'Automation Lab Updated' }),
    ])

    expect((await app.request(`/api/topologies/${created.id}`, { headers })).status).toBe(200)
    expect(
      (
        await app.request(`/api/topologies/${created.id}`, {
          method: 'DELETE',
          headers,
        })
      ).status,
    ).toBe(200)
    expect((await app.request(`/api/topologies/${created.id}`, { headers })).status).toBe(404)
  })

  test('supports authenticated data source CRUD through the generated contract', async () => {
    dataSources.clear()
    const app = createApp()
    const headers = {
      Authorization: `Bearer ${DEV_TOKEN}`,
      'Content-Type': 'application/json',
    }

    const createResponse = await app.request('/api/datasources', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Automation Source', type: 'example', configJson: '{}' }),
    })
    const created = (await createResponse.json()) as { id: string; name: string }
    expect(createResponse.status).toBe(201)
    expect(created.name).toBe('Automation Source')

    const updateResponse = await app.request(`/api/datasources/${created.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Automation Source Updated' }),
    })
    expect(updateResponse.status).toBe(200)
    expect(await updateResponse.json()).toMatchObject({ name: 'Automation Source Updated' })

    expect((await app.request('/api/datasources', { headers })).status).toBe(200)
    expect((await app.request('/api/datasources/types', { headers })).status).toBe(200)
    expect((await app.request('/api/datasources/by-capability/topology', { headers })).status).toBe(
      200,
    )
    expect(
      (await app.request(`/api/datasources/${created.id}/config-options/site`, { headers })).status,
    ).toBe(200)
    expect(
      (await app.request(`/api/datasources/${created.id}/connection-info`, { headers })).status,
    ).toBe(200)
    expect(
      (await app.request(`/api/datasources/${created.id}/topologies`, { headers })).status,
    ).toBe(200)
    expect(
      (
        await app.request(`/api/datasources/${created.id}/test`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(200)
    expect((await app.request(`/api/datasources/${created.id}`, { headers })).status).toBe(200)
    expect(
      (
        await app.request(`/api/datasources/${created.id}`, {
          method: 'DELETE',
          headers,
        })
      ).status,
    ).toBe(200)
    expect((await app.request(`/api/datasources/${created.id}`, { headers })).status).toBe(404)
  })
})
