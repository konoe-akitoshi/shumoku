/**
 * Arista CV-CUE (CloudVision Cognitive Unified Edge) plugin types.
 *
 * Field names mirror the CV-CUE Open API (`/wifi/api`, product `wm`). Only the
 * subset of fields the plugin actually reads is modeled; everything is optional
 * except the config the operator must supply. The full record still flows to the
 * "All metrics" panel via `flattenObject`, so unmodeled fields surface there.
 */

export interface AristaCvCueConfig {
  /**
   * API base URL, ending in `/wifi/api`, e.g.
   * `https://awm17001-c4.srv.wifi.arista.com/wifi/api`. Per-tenant/region.
   */
  baseUrl: string
  /** API key id from CV-CUE (Manage API Keys), e.g. `KEY-ATN571956-4368`. */
  keyId: string
  /** API key value (secret) paired with `keyId`. */
  keyValue: string
  /** Customer ID — only needed when the key spans more than one customer. */
  customerId?: string
  /** Location subtree to scope queries to. Defaults to `0` (root). */
  locationId?: number
}

// ----- Session ------------------------------------------------------------

/** Response body of a successful `POST /session`. */
export interface CvSessionResponse {
  sessionId?: string
  timeout?: number
  loginId?: string
  role?: string
  userType?: string
}

// ----- Paging -------------------------------------------------------------

/** Common paging envelope fields CV-CUE list endpoints return. */
export interface CvPaged {
  totalCount?: number
  nextLink?: string | null
  previousLink?: string | null
  pagingSessionId?: string | null
}

// ----- Managed devices (APs) ----------------------------------------------

export interface CvManagedDevicesResponse extends CvPaged {
  managedDevices?: CvManagedDevice[]
}

/** CV-CUE location reference — `{ type, id }` where `id` is the numeric node id. */
export interface CvLocationRef {
  type?: string
  id?: number
}

export interface CvManagedDevice {
  /** Stable per-device id in CV-CUE. */
  boxId?: number
  name?: string
  locationId?: CvLocationRef
  macaddress?: string
  model?: string
  vendorName?: string
  softwareVersion?: string
  ipAddress?: string
  /** True when the device is currently connected/managed. */
  active?: boolean
  /** e.g. `CONNECTED` / `DISCONNECTED`. */
  connectionStatus?: string
  /** Number of associated wireless clients. */
  assocCount?: number
  /** Epoch ms the device has been up since. */
  upSince?: number
  /** Epoch ms of the last record update. */
  lastUpdateTime?: number
  powerSource?: string
  numEthernetPorts?: number
  /** CPU / memory utilization counters (units are CV-CUE-defined). */
  healthStats?: Record<string, number>
  radios?: CvRadio[]
  /** Wired uplink info (LLDP neighbor switch + port), used for topology. */
  uplinkWiredInterfacesInfo?: CvUplinkInfo
}

/**
 * Per-radio live counters. `upstreamUsage` (client→network) and
 * `downstreamUsage` (network→client) are CV-CUE's throughput figures; they
 * refresh periodically (not per-second). Unit is undocumented — by magnitude it
 * reads as bits-per-second, which is what the plugin assumes.
 */
export interface CvRadio {
  radioId?: number
  active?: boolean
  operatingBand?: string
  upstreamUsage?: number
  downstreamUsage?: number
  rfUtilization?: number
}

/** Per-LAN-port uplink detail; carries the LLDP neighbor switch/port. */
export interface CvUplinkLanData {
  /** AP-side interface name, e.g. `eth0`. */
  name?: string
  primaryInterface?: boolean
  /** 1 = up. */
  linkStatus?: number
  /** Negotiated link speed in Mbps. */
  linkSpeed?: number
  /** LLDP neighbor (upstream switch). */
  switchName?: string
  switchPortId?: string
  switchChassisId?: string
  switchVendor?: string
}

export interface CvUplinkInfo {
  sensorLanPortName?: string
  sensorLinkSpeed?: number
  lan1Data?: CvUplinkLanData
  lan2Data?: CvUplinkLanData
}

// ----- Locations ----------------------------------------------------------

/** A node in the CV-CUE location hierarchy (folder / floor). */
export interface CvLocation {
  /** `{ id }` where `id` is the numeric location node id. */
  id?: CvLocationRef | number
  name?: string
  type?: string
  children?: CvLocation[]
}

// ----- Switches -----------------------------------------------------------

export interface CvSwitch {
  name?: string
  vendor?: string
  /** LLDP chassis id (MAC) — the strong identity key for the switch. */
  chassisId?: string
  chassisIdSubType?: number
  nodeId?: number
  numAps?: number
  numClients?: number
  apDistributionByLinkSpeedsInMbps?: Array<{ linkSpeed?: number; numAps?: number }>
  apDistributionByPoe?: Array<{ poeType?: string; numAps?: number }>
}

// ----- Events (alerts) ----------------------------------------------------

export interface CvEventsResponse extends CvPaged {
  eventList?: CvEvent[]
}

export interface CvEvent {
  id?: number | string
  majorType?: number | string
  intermediateType?: number | string
  minorType?: number | string
  category?: string
  summary?: string
  description?: string
  deleted?: boolean
  /** Epoch ms. */
  startTime?: number
  /** Epoch ms; 0/absent while the event is still active. */
  stopTime?: number
  locationId?: number
  readStatus?: string
  activityStatus?: string
  /** CV-CUE severity token: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `INFO`. */
  eventSeverity?: string
}
