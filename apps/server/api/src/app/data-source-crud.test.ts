import { describe, expect, it, vi } from 'vitest'
import type { DataSource } from '../types.js'
import { createDataSourceCrudService } from './data-source-crud.js'

function dataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'source-1',
    name: 'Source',
    type: 'example',
    configJson: '{}',
    status: 'unknown',
    failCount: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function createDependencies() {
  const source = dataSource()
  const store = {
    list: vi.fn(() => [source, dataSource({ id: 'internal', type: 'deep-read' })]),
    get: vi.fn((id: string) => (id === source.id ? source : null)),
    create: vi.fn(async () => source),
    update: vi.fn(async () => source),
    delete: vi.fn(() => true),
  }
  const topologyCache = { clearCacheForDataSource: vi.fn() }
  return { source, store, topologyCache }
}

describe('data source CRUD application service', () => {
  it('hides internal sources and invalidates topology caches on writes', async () => {
    const { store, topologyCache } = createDependencies()
    const service = createDataSourceCrudService(store, topologyCache)

    expect(service.list().map((source) => source.id)).toEqual(['source-1'])
    await service.update('source-1', { name: 'Updated' })
    service.delete('source-1')

    expect(topologyCache.clearCacheForDataSource).toHaveBeenNthCalledWith(1, 'source-1')
    expect(topologyCache.clearCacheForDataSource).toHaveBeenNthCalledWith(2, 'source-1')
  })

  it('rejects invalid JSON before persistence', async () => {
    const { store, topologyCache } = createDependencies()
    const service = createDataSourceCrudService(store, topologyCache)

    await expect(
      service.create({ name: 'Broken', type: 'example', configJson: '{' }),
    ).rejects.toThrow('configJson must be valid JSON')
    expect(store.create).not.toHaveBeenCalled()
  })
})
