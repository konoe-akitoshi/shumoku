/**
 * @shumoku/plugin-netbox
 * NetBox data source plugin and API client for Shumoku
 */

// Plugin class
export { NetBoxPlugin } from './plugin.js'

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

// Types
export type { LegendSettings } from '@shumoku/core/models'
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

import type { PluginRegistryInterface } from '@shumoku/core'
import { NetBoxPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register('netbox', 'NetBox', ['topology', 'hosts'], (config) => {
    const plugin = new NetBoxPlugin()
    plugin.initialize(config)
    return plugin
  })
}
