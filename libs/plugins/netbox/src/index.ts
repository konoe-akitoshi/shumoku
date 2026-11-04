/**
 * @shumoku/plugin-netbox
 * NetBox data source plugin and API client for Shumoku
 */

// API Client
export { NetBoxClient, type QueryParams, type QueryValue } from './client.js'

// Converter
export { convertToSourceNetwork, toYaml } from './converter.js'
// Plugin class
export { converterOptions, fetchFilters, NetBoxPlugin } from './plugin.js'
export type {
  ConverterOptions,
  FetchFilters,
  GroupDepth,
  NetBoxAsn,
  NetBoxCable,
  NetBoxCircuit,
  NetBoxCircuitTermination,
  NetBoxClientOptions,
  NetBoxCluster,
  NetBoxData,
  NetBoxDevice,
  NetBoxFhrpAssignment,
  NetBoxFhrpGroup,
  NetBoxInterface,
  NetBoxIPAddress,
  NetBoxL2vpn,
  NetBoxL2vpnTermination,
  NetBoxLocation,
  NetBoxPluginConfig,
  NetBoxPrefix,
  NetBoxProvider,
  NetBoxProviderNetwork,
  NetBoxSite,
  NetBoxTunnel,
  NetBoxTunnelGroup,
  NetBoxTunnelTermination,
  NetBoxVirtualChassis,
  NetBoxVirtualCircuit,
  NetBoxVirtualCircuitTermination,
  NetBoxVirtualMachine,
  NetBoxVlan,
  NetBoxVMInterface,
  NetBoxVrf,
  NetBoxWirelessLink,
} from './types.js'
export {
  DEFAULT_CIRCUIT_STATUSES,
  DEFAULT_DEVICE_STATUSES,
  emptyNetBoxData,
  nominalSpeedFromInterfaceType,
  ROLE_TO_TYPE,
} from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { NetBoxPlugin } from './plugin.js'

/** Connection config — the host renders this form and validates from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: { type: 'string', format: 'uri', title: 'NetBox URL' },
    token: { type: 'string', secret: true, title: 'API token' },
    insecure: {
      type: 'boolean',
      title: 'Skip TLS verification',
      default: false,
      warning: 'Disables certificate validation. Self-signed certs in trusted networks only.',
    },
  },
}

/**
 * Per-use topology options (rendered on the Sources page). The array fields
 * pull dynamic candidates via `getConfigOptions(key, config)` and allow free
 * entry when a connection isn't available yet.
 */
const optionsSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    groupDepth: {
      type: 'string',
      title: 'Group depth',
      default: 'location',
      help: 'How deep the places nest: sites, locations within them, or down to the rack.',
      oneOf: [
        { const: 'site', title: 'Site' },
        { const: 'location', title: 'Location' },
        { const: 'rack', title: 'Rack' },
      ],
    },
    siteFilter: {
      type: 'array',
      items: { type: 'string' },
      optionsSource: 'sites',
      freeSolo: true,
      title: 'Sites',
    },
    tagFilter: {
      type: 'array',
      items: { type: 'string' },
      optionsSource: 'tags',
      freeSolo: true,
      title: 'Tags',
    },
    roleFilter: {
      type: 'array',
      items: { type: 'string' },
      optionsSource: 'roles',
      freeSolo: true,
      title: 'Roles',
    },
    excludeRoleFilter: {
      type: 'array',
      items: { type: 'string' },
      optionsSource: 'roles',
      freeSolo: true,
      title: 'Exclude roles',
    },
    excludeTagFilter: {
      type: 'array',
      items: { type: 'string' },
      optionsSource: 'tags',
      freeSolo: true,
      title: 'Exclude tags',
    },
    tenantFilter: {
      type: 'array',
      items: { type: 'string' },
      freeSolo: true,
      title: 'Tenants',
      help: 'Tenant slugs.',
    },
    cloudClusterTypes: {
      type: 'array',
      items: { type: 'string' },
      optionsSource: 'clusterTypes',
      freeSolo: true,
      title: 'Cloud cluster types',
      help: 'Cluster types that are a cloud (such as aws). Each such cluster is drawn as a cloud that hosts its VMs. Nothing is guessed from names.',
    },
    roleTypes: {
      type: 'array',
      items: { type: 'string' },
      freeSolo: true,
      title: 'Role to node type',
      help: 'One role-slug=type per line, such as hypervisor=server, for roles the built-in mapping does not know.',
    },
    statusFilter: {
      type: 'array',
      items: { type: 'string' },
      freeSolo: true,
      title: 'Device and VM statuses',
      help: 'Statuses that are drawn. Default: active, staged, offline, failed, decommissioning (not planned or inventory).',
    },
    circuitStatusFilter: {
      type: 'array',
      items: { type: 'string' },
      freeSolo: true,
      title: 'Circuit statuses',
      help: 'Statuses that are drawn. Default: active, offline, provisioning, deprovisioning.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'netbox',
      displayName: 'NetBox',
      capabilities: ['topology', 'hosts'],
      configSchema,
      optionsSchema,
    },
    (config) => {
      const plugin = new NetBoxPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}
