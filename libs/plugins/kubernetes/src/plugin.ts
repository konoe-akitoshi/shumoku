import type {
  ConnectionResult,
  DataSourcePlugin,
  SourceNetwork,
  TopologyCapable,
} from '@shumoku/core'
import { fetchInventory, listResources, type RequestApi, requestInCluster } from './client.js'
import { type KubernetesConfig, parseConfig } from './config.js'
import { addGatewayTopology } from './gateway.js'
import { collectHubble, type HubbleSample } from './hubble.js'
import { addHubbleTopology } from './hubble-topology.js'
import { buildTopology } from './topology.js'
import { buildWorkloadTopology } from './workloads.js'

export class KubernetesPlugin implements DataSourcePlugin, TopologyCapable {
  readonly type = 'kubernetes'
  readonly displayName = 'Kubernetes'
  readonly capabilities = ['topology'] as const
  private config: KubernetesConfig = { namespaces: [], includeNodes: true }
  constructor(
    private readonly request: RequestApi = requestInCluster,
    private readonly collectFlows = collectHubble,
  ) {}
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
          'Sync also requires Pod, EndpointSlice, workload controllers (in workload view) and, if enabled, Node and Gateway API list access. Kubernetes relations show configuration. Optional Hubble observations are collected separately during sync.',
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
    const inventory = await fetchInventory(this.config, this.request)
    let topology =
      this.config.view === 'pods' ? buildTopology(inventory) : buildWorkloadTopology(inventory)
    if (this.config.includeGatewayAPI) topology = addGatewayTopology(topology, inventory)
    if (this.config.includeHubble) {
      const window = this.config.hubbleWindowSeconds ?? 60
      let sample: HubbleSample
      try {
        sample = await this.collectFlows(this.config.namespaces, window)
      } catch {
        const now = Date.now()
        sample = {
          since: now - window * 1000,
          until: now,
          flows: [],
          lostEvents: 0,
          unavailableNodes: 0,
          truncated: false,
          error:
            'Hubble unavailable. Check deployment enablement, Relay connection and TLS. No traffic conclusions can be drawn.',
        }
      }
      topology = addHubbleTopology(
        topology,
        inventory,
        sample,
        this.config.hubbleClusterName ?? 'default',
      )
    }
    return topology
  }
}
