/**
 * @shumoku/netbox
 * NetBox API client and Shumoku converter
 */

export { NetBoxClient, type QueryParams } from './client.js'
export { convertToNetworkGraph, convertToNetworkGraphWithVMs, toYaml } from './converter.js'
export type { LegendSettings } from '@shumoku/core/models'
export type {
  // NetBox API types
  NetBoxTag,
  NetBoxDevice,
  NetBoxDeviceResponse,
  NetBoxDeviceStatus,
  NetBoxVlan,
  NetBoxInterface,
  NetBoxInterfaceResponse,
  NetBoxTermination,
  NetBoxCable,
  NetBoxCableResponse,
  NetBoxSite,
  NetBoxSiteResponse,
  NetBoxLocation,
  NetBoxLocationResponse,
  // Virtual Machine types
  NetBoxCluster,
  NetBoxVirtualMachine,
  NetBoxVirtualMachineResponse,
  NetBoxVirtualMachineStatus,
  NetBoxVMInterface,
  NetBoxVMInterfaceResponse,
  // IPAM types
  NetBoxPrefix,
  NetBoxPrefixResponse,
  NetBoxIPAddress,
  NetBoxIPAddressResponse,
  // Configuration types
  TagMapping,
  ConverterOptions,
  NetBoxClientOptions,
  GroupBy,
  CableStyle,
  DeviceTypeString,
  DeviceStatusValue,
  DeviceStatusStyle,
  // Internal types
  DeviceData,
  ConnectionData,
} from './types.js'
export {
  DEFAULT_TAG_MAPPING,
  TAG_PRIORITY,
  CABLE_COLORS,
  CABLE_STYLES,
  ROLE_TO_TYPE,
  DEVICE_STATUS_STYLES,
  getVlanColor,
  convertSpeedToBandwidth,
} from './types.js'
