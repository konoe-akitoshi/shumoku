import { hasConfigOptions, hasConnectionInfo } from '@shumoku/core'
import { getAllPlugins } from '../plugins/loader.js'
import type { DataSourceService } from '../services/datasource.js'
import type { DataSourceOperationsService } from './services.js'

type DataSourceOperationsStore = Pick<
  DataSourceService,
  | 'get'
  | 'getPlugin'
  | 'getRegisteredTypes'
  | 'listAttachedTopologies'
  | 'listByCapability'
  | 'testConnection'
  | 'updateHealthStatus'
>

export function createDataSourceOperationsService(
  service: DataSourceOperationsStore,
): DataSourceOperationsService {
  return {
    listByCapability: (capability) => service.listByCapability(capability),
    listPluginTypes: () => {
      const plugins = getAllPlugins()
      const configSchemas = new Map(plugins.map((plugin) => [plugin.id, plugin.configSchema]))
      const optionsSchemas = new Map(plugins.map((plugin) => [plugin.id, plugin.optionsSchema]))

      return service.getRegisteredTypes().map(({ type, displayName, capabilities }) => ({
        type,
        displayName,
        capabilities,
        configSchema: configSchemas.get(type),
        optionsSchema: optionsSchemas.get(type),
      }))
    },
    getConfigOptions: async (id, key) => {
      const plugin = service.getPlugin(id)
      if (!plugin) return null
      if (!hasConfigOptions(plugin)) return []
      try {
        return await plugin.getConfigOptions(key, {})
      } catch (error) {
        console.error('[DataSources] getConfigOptions failed:', error)
        return []
      }
    },
    getConnectionInfo: (id, serverOrigin) => {
      const plugin = service.getPlugin(id)
      if (!plugin || !hasConnectionInfo(plugin)) return []
      const dataSource = service.get(id)
      const config = dataSource ? JSON.parse(dataSource.configJson) : {}
      try {
        return plugin.getConnectionInfo(config, { dataSourceId: id, serverOrigin })
      } catch (error) {
        console.error('[DataSources] getConnectionInfo failed:', error)
        return []
      }
    },
    listAttachedTopologies: (id) => {
      if (!service.get(id)) return null
      return service.listAttachedTopologies(id)
    },
    testConnection: async (id) => {
      const result = await service.testConnection(id)
      const dataSource = service.get(id)
      service.updateHealthStatus(
        id,
        result.success ? 'connected' : 'disconnected',
        result.message,
        result.success ? 0 : (dataSource?.failCount ?? 0) + 1,
      )
      return result
    },
  }
}
