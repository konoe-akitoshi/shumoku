import {
  type Alert,
  type AlertQueryOptions,
  hasConfigOptions,
  hasConnectionInfo,
} from '@shumoku/core'
import { getAllPlugins } from '../plugins/loader.js'
import { hasNativeApi } from '../plugins/types.js'
import type { DataSourceService } from '../services/datasource.js'
import type { AlertCollectionView, DataSourceOperationsService } from './services.js'

type DataSourceOperationsStore = Pick<
  DataSourceService,
  | 'get'
  | 'getPlugin'
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

/** The Server's alert collection (`services/alert-collector.ts`): readers never call a plugin. */
export interface AlertCollection {
  read(sourceId: string, options: AlertQueryOptions): Promise<Alert[]>
  refresh(sourceId: string): Promise<void>
  sourceState(sourceId: string): Omit<AlertCollectionView, 'openCount'> | null
  collected(sourceId: string): readonly { status: Alert['status'] }[]
}

export function createDataSourceOperationsService(
  service: DataSourceOperationsStore,
  alerts: AlertCollection,
): DataSourceOperationsService {
  const collectionOf = (id: string): AlertCollectionView | null => {
    const state = alerts.sourceState(id)
    if (!state) return null
    const openCount = alerts.collected(id).filter((a) => a.status === 'active').length
    return { ...state, openCount }
  }
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
      const plugin = await service.getPlugin(id)
      if (!plugin) return null
      if (!hasConfigOptions(plugin)) return []
      try {
        return await plugin.getConfigOptions(key, {})
      } catch (error) {
        console.error('[DataSources] getConfigOptions failed:', error)
        return []
      }
    },
    getConnectionInfo: async (id, serverOrigin) => {
      const plugin = await service.getPlugin(id)
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
      if (!(await service.hasAlertsCapability(id))) return null
      return alerts.read(id, options)
    },
    getAlertCollection: (id) => collectionOf(id),
    refreshAlerts: async (id) => {
      if (!alerts.sourceState(id)) return null
      await alerts.refresh(id)
      return collectionOf(id)
    },
    callNative: async (id, method, params) => {
      const plugin = await service.getPlugin(id)
      if (!plugin) return { ok: false, status: 404, error: 'Data source not found' }
      if (!hasNativeApi(plugin)) {
        return { ok: false, status: 400, error: 'Plugin does not expose a native API' }
      }
      return { ok: true, result: await plugin.nativeApi(method, params) }
    },
  }
}
