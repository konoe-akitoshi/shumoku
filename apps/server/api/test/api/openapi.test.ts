// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { createApiRouter } from '../../src/api/index.js'
import type { AppServices } from '../../src/app/services.js'
import { getDatabase } from '../../src/db/index.js'
import { createOpenApiDocument } from '../../src/openapi/document.js'
import { legacyApiOperations } from '../../src/openapi/legacy-operations.js'
import { TopologyService } from '../../src/services/topology.js'
import { setupTempDb, type TempDb } from '../db/helper.js'

const DEV_TOKEN = 'a'.repeat(64)
let database: TempDb
let originalNodeEnv: string | undefined
let originalHost: string | undefined
let originalDevToken: string | undefined
let topologyService: TopologyService

const services: AppServices = {
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
      topologies: { database: 0, legacyFile: 0 },
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
  test('tracks every HTTP API route in the contract or migration ledger', () => {
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
    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const method of openApiMethods) {
        if (pathItem && method in pathItem) contractOperations.add(operationKey(method, path))
      }
    }

    const missingAtRuntime = [...contractOperations]
      .filter((operation) => !runtimeOperations.has(operation))
      .sort()
    const undocumented = [...runtimeOperations]
      .filter((operation) => !contractOperations.has(operation))
      .sort()

    expect(missingAtRuntime).toEqual([])
    expect(undocumented).toEqual(legacyApiOperations)
  })

  test('keeps health public and protects diagnostics after setup', async () => {
    const app = createApp()

    expect((await app.request('/api/health')).status).toBe(200)
    expect((await app.request('/api/admin/status')).status).toBe(401)
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
})
