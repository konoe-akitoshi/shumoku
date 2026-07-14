export { PrometheusPlugin } from './plugin.js'
export type {
  PrometheusCustomMetrics,
  PrometheusJobFilterMode,
  PrometheusLinkMapping,
  PrometheusMetricPreset,
  PrometheusNodeMapping,
  PrometheusPluginConfig,
} from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { PrometheusPlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['url', 'preset', 'jobFilter'],
  properties: {
    url: { type: 'string', format: 'uri', title: 'Prometheus URL' },
    preset: {
      type: 'string',
      title: 'Metric preset',
      default: 'snmp',
      oneOf: [
        { const: 'snmp', title: 'SNMP Exporter' },
        { const: 'node_exporter', title: 'Node Exporter' },
        { const: 'custom', title: 'Custom metrics' },
      ],
    },
    customMetrics: {
      type: 'object',
      title: 'Custom metrics',
      visibleWhen: { field: 'preset', equals: 'custom' },
      requiredWhen: { field: 'preset', equals: 'custom' },
      required: ['inOctets', 'outOctets', 'interfaceLabel'],
      properties: {
        inOctets: { type: 'string', title: 'Inbound octets metric', placeholder: 'ifHCInOctets' },
        outOctets: {
          type: 'string',
          title: 'Outbound octets metric',
          placeholder: 'ifHCOutOctets',
        },
        interfaceLabel: { type: 'string', title: 'Interface label', placeholder: 'ifName' },
        upMetric: { type: 'string', title: 'Up metric', placeholder: 'up' },
      },
    },
    hostLabel: {
      type: 'string',
      title: 'Host label',
      default: 'instance',
      help: 'Label identifying hosts.',
    },
    jobFilter: {
      type: 'string',
      title: 'Job filter',
      help: 'Required job label scope. Use one exact job or switch to regex for a related job family.',
    },
    jobFilterMode: {
      type: 'string',
      title: 'Job filter mode',
      default: 'exact',
      oneOf: [
        { const: 'exact', title: 'Exact match' },
        { const: 'regex', title: 'Regular expression (RE2)' },
      ],
      help: 'Regex matches are fully anchored by Prometheus; use snmp-.* for a prefix.',
    },
    alertmanagerUrl: {
      type: 'string',
      format: 'uri',
      title: 'Alertmanager URL',
      help: 'Defaults to the Prometheus URL.',
    },
    basicAuth: {
      type: 'object',
      title: 'Basic auth (optional)',
      properties: {
        username: { type: 'string', title: 'Username' },
        password: { type: 'string', secret: true, title: 'Password' },
      },
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'prometheus',
      displayName: 'Prometheus',
      capabilities: ['metrics', 'hosts', 'alerts'],
      configSchema,
    },
    (config) => {
      const plugin = new PrometheusPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}
