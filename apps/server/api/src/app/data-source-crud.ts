import { validateAgainstSchema } from '@shumoku/core'
import { getAllPlugins } from '../plugins/loader.js'
import type { DataSourceService } from '../services/datasource.js'
import type { DataSourceInput } from '../types.js'
import type { DataSourceCrudService } from './services.js'

interface TopologyCacheInvalidator {
  clearCacheForDataSource(dataSourceId: string): void
}

type DataSourceStore = Pick<DataSourceService, 'list' | 'get' | 'create' | 'update' | 'delete'>

function validateConfigForType(type: string, configJson: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(configJson)
  } catch {
    throw new Error('configJson must be valid JSON')
  }

  const schema = getAllPlugins().find((plugin) => plugin.id === type)?.configSchema
  if (!schema) return

  const result = validateAgainstSchema(schema, parsed)
  if (!result.ok) {
    throw new Error(result.errors.map((error) => `${error.path}: ${error.message}`).join('; '))
  }
}

export function createDataSourceCrudService(
  service: DataSourceStore,
  topologyCache: TopologyCacheInvalidator,
): DataSourceCrudService {
  return {
    list: () => service.list().filter((dataSource) => dataSource.type !== 'deep-read'),
    get: (id) => service.get(id),
    create: async (input) => {
      validateConfigForType(input.type, input.configJson)
      return service.create(input)
    },
    update: async (id, input: Partial<DataSourceInput>) => {
      if (input.configJson !== undefined) {
        const type = input.type ?? service.get(id)?.type
        if (type) validateConfigForType(type, input.configJson)
      }

      const dataSource = await service.update(id, input)
      if (dataSource) topologyCache.clearCacheForDataSource(id)
      return dataSource
    },
    delete: (id) => {
      topologyCache.clearCacheForDataSource(id)
      return service.delete(id)
    },
  }
}
