import type { PluginConfigSchema } from '@shumoku/core'
import { validateAgainstSchema } from '@shumoku/core/plugin-kit'

export interface KubernetesConfig {
  namespaces: string[]
  includeNodes: boolean
}
export const configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
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
  return { namespaces, includeNodes: config.includeNodes ?? true }
}
