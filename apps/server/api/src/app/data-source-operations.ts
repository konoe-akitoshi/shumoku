import { type Alert, hasConfigOptions, hasConnectionInfo } from '@shumoku/core'
import { getAllPlugins } from '../plugins/loader.js'
import { hasNativeApi } from '../plugins/types.js'
import type { DataSourceService } from '../services/datasource.js'
import type { DataSourceOperationsService } from './services.js'

type DataSourceOperationsStore = Pick<
  DataSourceService,
  | 'get'
  | 'getPlugin'
  | 'getAlerts'
  | 'getFilterOptions'
  | 'getHostItems'
  | 'getHosts'
  | 'getInterfaceNeighbors'
  | 'discoverMetrics'
  | 'hasAlertsCapability'
  | 'getRegisteredTypes'
  | 'listAttachedTopologies'
  | 'listByCapability'
  | 'testConnection'
  | 'updateHealthStatus'
>

interface AlertStreamIngestor {
  ingestAlerts(
    dataSourceId: string,
    topologyId: string | null,
    alerts: Alert[],
    options: { fullActiveSet: boolean },
  ): Promise<unknown>
}

export function createDataSourceOperationsService(
  service: DataSourceOperationsStore,
  alertStream: AlertStreamIngestor,
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
    getHosts: (id) => service.getHosts(id),
    getHostItems: (id, hostId) => service.getHostItems(id, hostId),
    getInterfaceNeighbors: (id, hostId) => service.getInterfaceNeighbors(id, hostId),
    discoverMetrics: (id, hostId) => service.discoverMetrics(id, hostId),
    getFilterOptions: (id) => service.getFilterOptions(id),
    getAlerts: async (id, options) => {
      if (!service.hasAlertsCapability(id)) return null
      const alerts = await service.getAlerts(id, options)
      const fullActiveSet =
        options.timeRange === undefined && options.minSeverity === undefined && !options.activeOnly
      alertStream
        .ingestAlerts(id, null, alerts, { fullActiveSet })
        .catch((error) => console.error('[Datasources] alert stream ingest failed:', error))
      return alerts
    },
    callNative: async (id, method, params) => {
      const plugin = service.getPlugin(id)
      if (!plugin) return { ok: false, status: 404, error: 'Data source not found' }
      if (!hasNativeApi(plugin)) {
        return { ok: false, status: 400, error: 'Plugin does not expose a native API' }
      }
      return { ok: true, result: await plugin.nativeApi(method, params) }
    },
  }
}
