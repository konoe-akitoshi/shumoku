import { OpenAPIHono } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vitest'
import type { PluginApplicationService, PluginInfoView } from '../../app/services.js'
import { createPluginApi } from './routes.js'

function plugin(): PluginInfoView {
  return {
    id: 'example',
    name: 'Example',
    version: '1.0.0',
    path: '/plugins/example',
    capabilities: ['topology'],
    enabled: true,
    bundled: false,
  }
}

function createService(): PluginApplicationService {
  return {
    list: vi.fn(() => [plugin()]),
    getManifest: vi.fn(async () => ({
      ok: true,
      value: {
        id: 'example',
        name: 'Example',
        version: '1.0.0',
        capabilities: ['topology'],
      },
    })),
    installFromPath: vi.fn(async () => ({ ok: true, value: plugin() })),
    installFromUrl: vi.fn(async () => ({ ok: true, value: plugin() })),
    installFromZip: vi.fn(async () => ({ ok: true, value: plugin() })),
    setEnabled: vi.fn(async () => ({ ok: true, value: { success: true } })),
    remove: vi.fn(async () => ({ ok: true, value: { success: true } })),
    reload: vi.fn(async () => ({
      ok: true,
      value: { success: true, plugins: [plugin()], count: 1 },
    })),
  }
}

function createApp(service = createService()): OpenAPIHono {
  return new OpenAPIHono().route('/plugins', createPluginApi({ plugins: service }))
}

describe('OpenAPI plugin routes', () => {
  it('supports listing, manifests, JSON installs, state changes, removal, and reload', async () => {
    const app = createApp()
    expect((await app.request('/plugins')).status).toBe(200)
    expect((await app.request('/plugins/example/manifest')).status).toBe(200)
    expect(
      (
        await app.request('/plugins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/plugins/example' }),
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await app.request('/plugins/example', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        })
      ).status,
    ).toBe(200)
    expect((await app.request('/plugins/example', { method: 'DELETE' })).status).toBe(200)
    expect((await app.request('/plugins/reload', { method: 'POST' })).status).toBe(200)
  })

  it('publishes all seven operations with explicit install media types', () => {
    const document = createApp().getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'test', version: 'test' },
    })
    expect(document.paths['/plugins']?.get).toBeDefined()
    expect(document.paths['/plugins']?.post?.requestBody).toMatchObject({
      content: { 'application/json': expect.anything() },
    })
    expect(document.paths['/plugins/upload']?.post?.requestBody).toMatchObject({
      content: { 'multipart/form-data': expect.anything() },
    })
    expect(document.paths['/plugins/{id}/manifest']?.get).toBeDefined()
    expect(document.paths['/plugins/{id}']?.patch).toBeDefined()
    expect(document.paths['/plugins/{id}']?.delete).toBeDefined()
    expect(document.paths['/plugins/reload']?.post).toBeDefined()
  })
})
