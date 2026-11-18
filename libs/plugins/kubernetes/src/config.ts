import type { PluginConfigSchema } from '@shumoku/core'
import { validateAgainstSchema } from '@shumoku/core/plugin-kit'

export interface KubernetesConfig {
  namespaces: string[]
  includeNodes: boolean
  includeHubble?: boolean
  hubbleWindowSeconds?: number
  hubbleClusterName?: string
  includeGatewayAPI?: boolean
  view?: 'workloads' | 'pods'
}
export const configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    includeHubble: {
      type: 'boolean',
      default: false,
      title: 'Observe Hubble flows',
      help: 'Requires Hubble Relay configured in server Helm values. Collects a bounded recent window on each source sync; events are not bytes or requests.',
    },
    hubbleWindowSeconds: {
      type: 'number',
      default: 60,
      title: 'Hubble observation window (seconds)',
    },
    hubbleClusterName: {
      type: 'string',
      default: 'default',
      title: 'Hubble cluster name',
      help: 'Must match the local Cilium cluster name. Remote ClusterMesh endpoints are not mapped to local Pods.',
    },
    includeGatewayAPI: {
      type: 'boolean',
      default: false,
      title: 'Include Gateway API',
      help: 'Requires Gateway API CRDs and list access to Gateways, HTTPRoutes and ReferenceGrants in every selected namespace. Include Gateway and backend namespaces in the scope.',
    },
    view: {
      type: 'string',
      title: 'Map view',
      default: 'workloads',
      oneOf: [
        { const: 'workloads', title: 'Services and workloads' },
        { const: 'pods', title: 'Pods and Node placement' },
      ],
      help: 'Workload view groups Pods by controller ownership. Both views show configured backends, not observed traffic.',
    },
    namespaces: {
      type: 'array',
      items: { type: 'string' },
      title: 'Namespaces',
      help: 'Empty means all namespaces. Requires read access to each selected namespace.',
    },
    includeNodes: {
      type: 'boolean',
      default: true,
      title: 'Show Node placement',
      help: 'Requires cluster-wide list access to Nodes. Disable for namespace-only RBAC.',
    },
  },
}
export function parseConfig(value: unknown): KubernetesConfig {
  const result = validateAgainstSchema(configSchema, value)
  if (!result.ok) throw new Error('Invalid Kubernetes configuration')
  const config = value as Partial<KubernetesConfig>
  const namespaces = [...new Set(config.namespaces ?? [])].sort()
  if (namespaces.some((name) => !/^[a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?$/.test(name))) {
    throw new Error('Namespaces must be valid Kubernetes namespace names')
  }
  const window = config.hubbleWindowSeconds ?? 60
  if (!Number.isInteger(window) || window < 10 || window > 300)
    throw new Error('Hubble window must be 10–300 seconds')
  return {
    includeHubble: config.includeHubble ?? false,
    hubbleWindowSeconds: window,
    hubbleClusterName: config.hubbleClusterName ?? 'default',
    namespaces,
    includeNodes: config.includeNodes ?? true,
    view: config.view ?? 'workloads',
    includeGatewayAPI: config.includeGatewayAPI ?? false,
  }
}
