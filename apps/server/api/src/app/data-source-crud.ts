import { validateAgainstSchema } from '@shumoku/core'
import { DEEP_READ_TYPE } from '../plugins/deep-read-source.js'
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

/** The alert collection follows the data sources: a new one is collected, a gone one dropped. */
interface AlertSourcesFollower {
  syncSources(): void
  refresh(sourceId: string): Promise<void>
}

export function createDataSourceCrudService(
  service: DataSourceStore,
  topologyCache: TopologyCacheInvalidator,
  alertSources?: AlertSourcesFollower,
): DataSourceCrudService {
  const follow = (id?: string) => {
    alertSources?.syncSources()
    // A changed configuration (an address, a token) is collected with at once.
    if (id) {
      alertSources?.refresh(id).catch((error) => {
        console.error(`[DataSources] alert refresh of ${id} failed:`, error)
      })
    }
  }
  return {
    list: () => service.list().filter((dataSource) => dataSource.type !== DEEP_READ_TYPE),
    get: (id) => service.get(id),
    create: async (input) => {
      validateConfigForType(input.type, input.configJson)
      const created = await service.create(input)
      follow()
      return created
    },
    update: async (id, input: Partial<DataSourceInput>) => {
      if (input.configJson !== undefined) {
        const type = input.type ?? service.get(id)?.type
        if (type) validateConfigForType(type, input.configJson)
      }

      const dataSource = await service.update(id, input)
      if (dataSource) {
        topologyCache.clearCacheForDataSource(id)
        follow(id)
      }
      return dataSource
    },
    delete: (id) => {
      topologyCache.clearCacheForDataSource(id)
      const deleted = service.delete(id)
      follow()
      return deleted
    },
  }
}
