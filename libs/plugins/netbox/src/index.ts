/**
 * @shumoku/plugin-netbox
 * NetBox data source plugin and API client for Shumoku
 */

// Types
export type { LegendSettings } from '@shumoku/core/models'

// API Client
export { NetBoxClient, type QueryParams } from './client.js'

// Converter
export type {
  CrossLocationLink,
  HierarchicalConverterOptions,
  HierarchicalOutput,
} from './converter.js'
export {
  convertToHierarchicalYaml,
  convertToNetworkGraph,
  convertToNetworkGraphWithVMs,
  toYaml,
} from './converter.js'
// Plugin class
export { NetBoxPlugin } from './plugin.js'
export type {
  CableStyle,
  ConnectionData,
  ConverterOptions,
  DeviceData,
  DeviceStatusStyle,
  DeviceStatusValue,
  DeviceTypeString,
  GroupBy,
  NetBoxCable,
  NetBoxCableResponse,
  NetBoxClientOptions,
  NetBoxCluster,
  NetBoxDevice,
  NetBoxDeviceResponse,
  NetBoxDeviceStatus,
  NetBoxInterface,
  NetBoxInterfaceResponse,
  NetBoxIPAddress,
  NetBoxIPAddressResponse,
  NetBoxLocation,
  NetBoxLocationResponse,
  NetBoxPluginConfig,
  NetBoxPrefix,
  NetBoxPrefixResponse,
  NetBoxSite,
  NetBoxSiteResponse,
  NetBoxTag,
  NetBoxTagFull,
  NetBoxTagResponse,
  NetBoxTermination,
  NetBoxVirtualMachine,
  NetBoxVirtualMachineResponse,
  NetBoxVirtualMachineStatus,
  NetBoxVlan,
  NetBoxVMInterface,
  NetBoxVMInterfaceResponse,
  TagMapping,
} from './types.js'
export {
  CABLE_COLORS,
  CABLE_STYLES,
  convertSpeedToBandwidth,
  DEFAULT_TAG_MAPPING,
  DEVICE_STATUS_STYLES,
  getVlanColor,
  ROLE_TO_TYPE,
  TAG_PRIORITY,
} from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { NetBoxPlugin } from './plugin.js'

/** Connection config — the host renders this form and validates from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: { type: 'string', format: 'uri', title: 'NetBox URL' },
    token: { type: 'string', format: 'password', title: 'API token' },
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
    groupBy: {
      type: 'string',
      title: 'Group by',
      default: 'tag',
      oneOf: [
        { const: 'tag', title: 'Tag' },
        { const: 'site', title: 'Site' },
        { const: 'location', title: 'Location' },
        { const: 'prefix', title: 'Prefix' },
        { const: 'none', title: 'No grouping' },
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
