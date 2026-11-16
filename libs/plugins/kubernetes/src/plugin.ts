import type {
  ConnectionResult,
  DataSourcePlugin,
  SourceNetwork,
  TopologyCapable,
} from '@shumoku/core'
import { fetchInventory, listResources, type RequestApi, requestInCluster } from './client.js'
import { type KubernetesConfig, parseConfig } from './config.js'
import { buildTopology } from './topology.js'

export class KubernetesPlugin implements DataSourcePlugin, TopologyCapable {
  readonly type = 'kubernetes'
  readonly displayName = 'Kubernetes'
  readonly capabilities = ['topology'] as const
  private config: KubernetesConfig = { namespaces: [], includeNodes: true }
  constructor(private readonly request: RequestApi = requestInCluster) {}
  initialize(config: unknown): void {
    this.config = parseConfig(config)
  }
  async testConnection(): Promise<ConnectionResult> {
    try {
      const namespace = this.config.namespaces[0]
      const path = namespace ? `/api/v1/namespaces/${namespace}/services` : '/api/v1/services'
      await listResources(this.request, path)
      return {
        success: true,
        message: 'Kubernetes API reachable',
        warnings: [
          'Sync also requires Pod, EndpointSlice and, if enabled, Node list access. This source shows configuration, not traffic.',
        ],
      }
    } catch {
      // Do not surface upstream response bodies or credential-bearing transport errors.
      return {
        success: false,
        message:
          'Cannot list Kubernetes Services. Check the mounted ServiceAccount token, CA and RBAC.',
      }
    }
  }
  async fetchTopology(): Promise<SourceNetwork> {
    return buildTopology(await fetchInventory(this.config, this.request))
  }
}
