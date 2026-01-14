/**
 * @shumoku/netbox
 * NetBox API client and Shumoku converter
 */

export type { LegendSettings } from '@shumoku/core/models'
export { NetBoxClient, type QueryParams } from './client.js'
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
export type {
  CableStyle,
  ConnectionData,
  ConverterOptions,
  // Internal types
  DeviceData,
  DeviceStatusStyle,
  DeviceStatusValue,
  DeviceTypeString,
  GroupBy,
  NetBoxCable,
  NetBoxCableResponse,
  NetBoxClientOptions,
  // Virtual Machine types
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
  // IPAM types
  NetBoxPrefix,
  NetBoxPrefixResponse,
  NetBoxSite,
  NetBoxSiteResponse,
  // NetBox API types
  NetBoxTag,
  NetBoxTermination,
  NetBoxVirtualMachine,
  NetBoxVirtualMachineResponse,
  NetBoxVirtualMachineStatus,
  NetBoxVlan,
  NetBoxVMInterface,
  NetBoxVMInterfaceResponse,
  // Configuration types
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
