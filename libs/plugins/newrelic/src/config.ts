import type { PluginConfigSchema } from '@shumoku/core'

export interface NewRelicConfig {
  inventoryLookbackDays?: number
  snmpFreshnessSeconds?: number
  infraFreshnessSeconds?: number
  neighborMode?: 'disabled' | 'auto' | 'required'
  includeInfrastructure?: boolean
  accountId: number
  apiKey: string
  region: 'US' | 'EU' | 'JP'
}

export const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['accountId', 'apiKey', 'region'],
  properties: {
    inventoryLookbackDays: {
      type: 'number',
      title: 'Inventory history (days)',
      default: 7,
      minimum: 1,
      maximum: 30,
    },
    snmpFreshnessSeconds: {
      type: 'number',
      title: 'SNMP freshness (seconds)',
      default: 180,
      minimum: 60,
      maximum: 86400,
    },
    infraFreshnessSeconds: {
      type: 'number',
      title: 'Infrastructure freshness (seconds)',
      default: 1200,
      minimum: 60,
      maximum: 86400,
    },
    neighborMode: {
      type: 'string',
      title: 'Neighbor discovery',
      default: 'auto',
      oneOf: ['auto', 'required', 'disabled'].map((value) => ({ const: value, title: value })),
    },
    includeInfrastructure: {
      type: 'boolean',
      title: 'Include Infrastructure hosts',
      default: true,
    },
    accountId: { type: 'number', title: 'Account ID', minimum: 1 },
    apiKey: { type: 'string', secret: true, title: 'User API key' },
    region: {
      type: 'string',
      title: 'Data region',
      default: 'US',
      help: 'The account data region, not your location. The key is sent only to this region.',
      oneOf: ['US', 'EU', 'JP'].map((region) => ({ const: region, title: region })),
    },
  },
}
