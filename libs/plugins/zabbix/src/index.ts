export { ZabbixPlugin } from './plugin.js'
export type { ZabbixHost, ZabbixItem, ZabbixPluginConfig } from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { ZabbixPlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      title: 'Zabbix URL',
      placeholder: 'https://zabbix.example.com',
    },
    token: { type: 'string', format: 'password', title: 'API token' },
    insecure: {
      type: 'boolean',
      title: 'Skip TLS verification',
      default: false,
      warning: 'Disables certificate validation. Self-signed certs in trusted networks only.',
    },
    pollInterval: {
      type: 'number',
      title: 'Polling interval',
      default: 60000,
      oneOf: [
        { const: 5000, title: '5 seconds' },
        { const: 10000, title: '10 seconds' },
        { const: 30000, title: '30 seconds' },
        { const: 60000, title: '1 minute' },
        { const: 300000, title: '5 minutes' },
      ],
    },
  },
}

/**
 * Per-attachment topology options (rendered on the Sources page, stored as the
 * attachment's `optionsJson`). Topology is generated from hosts (nodes) + LLDP
 * neighbor items (links); see the design doc.
 */
const optionsSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    hostGroups: {
      type: 'array',
      items: { type: 'string' },
      title: 'Host groups',
      help: 'Limit the import to these host groups. Strongly recommended — large instances have thousands of hosts. Empty = all.',
      optionsSource: 'hostgroup',
      freeSolo: true,
      scope: { kind: 'include', key: 'hostGroups' },
    },
    groupBy: {
      type: 'string',
      title: 'Group by',
      default: 'hostgroup',
      help: 'Nest each node under its most-specific host group, or emit a flat graph.',
      oneOf: [
        { const: 'hostgroup', title: 'Host group' },
        { const: 'none', title: 'No grouping' },
      ],
    },
    groupExclude: {
      type: 'array',
      items: { type: 'string' },
      title: 'Exclude groups',
      help: 'Host-group names to never use as a subgraph (admin / catch-all groups).',
      optionsSource: 'hostgroup',
      freeSolo: true,
      scope: { kind: 'exclude', key: 'hostGroups' },
    },
    includeExternalNeighbors: {
      type: 'boolean',
      title: 'Include external neighbors',
      default: true,
      help: 'Add nodes for LLDP neighbors that are not Zabbix hosts, so their links still render.',
    },
    parentTag: {
      type: 'string',
      title: 'Parent tag',
      default: 'PARENT',
      help: 'Host-tag name whose value names an upstream device — draws a link where LLDP saw no neighbor. Empty to disable.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'zabbix',
      displayName: 'Zabbix',
      capabilities: ['metrics', 'hosts', 'alerts', 'topology'],
      configSchema,
      optionsSchema,
    },
    (config) => {
      const plugin = new ZabbixPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}
