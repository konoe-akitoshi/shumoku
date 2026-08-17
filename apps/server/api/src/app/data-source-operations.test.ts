import type { DataSourcePlugin } from '@shumoku/core'
import { describe, expect, it, vi } from 'vitest'
import type { DataSourceService } from '../services/datasource.js'
import type { DataSource } from '../types.js'
import { createDataSourceOperationsService } from './data-source-operations.js'

function dataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'source-1',
    name: 'Network Source',
    type: 'example',
    configJson: '{}',
    status: 'unknown',
    failCount: 2,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function createStore(overrides: Partial<DataSourceService> = {}): DataSourceService {
  return {
    get: vi.fn(() => dataSource()),
    getPlugin: vi.fn(() => null),
    getRegisteredTypes: vi.fn(() => []),
    listAttachedTopologies: vi.fn(() => []),
    listByCapability: vi.fn(() => []),
    testConnection: vi.fn(async () => ({ success: true, message: 'Connected' })),
    updateHealthStatus: vi.fn(),
    ...overrides,
  } as unknown as DataSourceService
}

describe('data source operations service', () => {
  const alertStream = { ingestAlerts: vi.fn(async () => undefined) }

  it('updates persisted health after a connection test', async () => {
    const store = createStore()
    const service = createDataSourceOperationsService(store, alertStream)

    await expect(service.testConnection('source-1')).resolves.toEqual({
      success: true,
      message: 'Connected',
    })
    expect(store.updateHealthStatus).toHaveBeenCalledWith('source-1', 'connected', 'Connected', 0)
  })

  it('increments the failure count after a failed connection test', async () => {
    const store = createStore({
      testConnection: vi.fn(async () => ({ success: false, message: 'Unavailable' })),
    })
    const service = createDataSourceOperationsService(store, alertStream)

    await service.testConnection('source-1')

    expect(store.updateHealthStatus).toHaveBeenCalledWith(
      'source-1',
      'disconnected',
      'Unavailable',
      3,
    )
  })

  it('distinguishes a missing source from a plugin without dynamic options', async () => {
    const plugin: DataSourcePlugin = {
      type: 'example',
      displayName: 'Example',
      capabilities: [],
      initialize: vi.fn(),
      testConnection: vi.fn(async () => ({ success: true, message: 'Connected' })),
    }
    const store = createStore({
      getPlugin: vi.fn((id) => (id === 'missing' ? null : plugin)),
    })
    const service = createDataSourceOperationsService(store, alertStream)

    await expect(service.getConfigOptions('missing', 'site')).resolves.toBeNull()
    await expect(service.getConfigOptions('source-1', 'site')).resolves.toEqual([])
  })
})
