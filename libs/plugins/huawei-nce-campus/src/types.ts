/**
 * Huawei iMaster NCE-Campus plugin types.
 *
 * Field names mirror the NCE-Campus northbound RESTful API (NBI,
 * V300R024C00). Only the subset the plugin reads is modeled; everything is
 * optional except the config the operator must supply. Full records still
 * flow to the "All metrics" panel via `flattenObject`, so unmodeled fields
 * surface there.
 */

export interface HuaweiNceCampusConfig {
  /**
   * NBI base URL of the controller, e.g. `https://nce.example.com:18002`.
   * All API paths (`/controller/...`, `/v1/...`) are appended to this.
   */
  baseUrl: string
  /** Third-party (NBI User Group) account name. */
  userName: string
  /** Password paired with `userName`. */
  password: string
  /** Optional site ID (UUID) to scope topology/hosts to a single site. */
  siteId?: string
  /**
   * Skip TLS certificate verification. On-prem controllers commonly serve
   * Huawei's self-signed platform cert; trusted networks only.
   */
  insecure?: boolean
}

// ----- Auth -----------------------------------------------------------------

/** Response body of `POST /controller/v2/tokens`. */
export interface NceTokenResponse {
  errcode?: string
  errmsg?: string
  data?: {
    token_id?: string
    /** UTC expiry, `yyyy-MM-dd HH:mm:ss`. Sliding — refreshed on use. */
    expiredDate?: string
  }
}

// ----- Paging ---------------------------------------------------------------

/** Envelope of the v3 list endpoints (`/controller/campus/v3/...`). */
export interface NcePagedResponse<T> {
  errcode?: string
  errmsg?: string
  totalRecords?: number
  pageIndex?: number
  pageSize?: number
  data?: T[]
}

// ----- Sites ----------------------------------------------------------------

/** One site from `GET /controller/campus/v3/sites`. */
export interface NceSite {
  id?: string
  tenantId?: string
  name?: string
  organizationId?: string
  organizationName?: string
  description?: string
  type?: string[]
}

// ----- Devices --------------------------------------------------------------

/**
 * One device from `GET /controller/campus/v3/devices`.
 * `status`: 0 = normal, 1 = alarm, 3 = offline, 4 = not registered.
 */
export interface NceDevice {
  /** Device UUID — the stable NCE-side id. */
  id?: string
  /** Device name shown on the controller UI (operator-editable). */
  name?: string
  /** Equipment serial number. */
  esn?: string
  deviceModel?: string
  /** Device class: `AP`, `AR`, `FW`, or `LSW`. */
  deviceType?: string
  status?: string
  siteId?: string
  siteName?: string
  mac?: string
  ip?: string
  manageIp?: string
  /** Device model string (per the doc, corresponds to "Device Model"). */
  neType?: string
  version?: string
  vendor?: string
  description?: string
  tenantId?: string
  tenantName?: string
  registerTime?: string
  startupTime?: string
  tags?: string[]
  uptime?: string
}

// ----- LLDP neighbors -------------------------------------------------------

/** One LLDP neighbor entry of a device. */
export interface NceLldpNeighbor {
  /** Local interface the neighbor was heard on, e.g. `GigabitEthernet0/0/1`. */
  localIfName?: string
  /** Neighbor's port, as the neighbor reports it. */
  remoteIfName?: string
  /** Neighbor's self-reported system name. */
  sysName?: string
  sysDescription?: string
  remoteMac?: string
  sysCapEnabled?: string
  sysCapSupported?: string
}

/** Envelope of `GET .../topomanager/device/{deviceId}/neighbors`. */
export interface NceLldpResponse {
  errcode?: string
  errmsg?: string
  totalRecords?: number
  pageIndex?: number
  pageSize?: number
  data?: {
    lldp?: NceLldpNeighbor[]
  }
}

// ----- Links (Link Management) ----------------------------------------------

/**
 * One link from `GET /rest/openapi/network/link`.
 *
 * Preferred over the topology API (`topomanager/device/node`): both ends carry
 * the managed device's UUID (`anedn` / `znedn`, the same id `/v3/devices`
 * returns) plus a port name. The topology API returns nothing unless queried
 * per site via `parentResId`, and even then leaves the port names null on some
 * deployments, which would leave links unmappable to interfaces.
 */
export interface NceNetworkLink {
  linkdn?: string
  /** Composite name, e.g. `ap-01_MultiGE0/0/0_sw-01_GE0/0/1`. */
  linkname?: string
  /** A-end device UUID / name / management IP. */
  anedn?: string
  anename?: string
  aneip?: string
  aportname?: string
  /**
   * A-end port DN. A real port is a UUID here; when the DN merely repeats
   * `aportname`, NCE holds no port entity — the string came straight off an
   * LLDP TLV. See {@link NceNetworkLink.zportdn}.
   */
  aportdn?: string
  /** Z-end device UUID / name / management IP. `0.0.0.0` means "no address". */
  znedn?: string
  znename?: string
  zneip?: string
  zportname?: string
  /**
   * Z-end port DN. Same rule as `aportdn`: `zportdn === zportname` means the
   * port does not exist as an entity, so several links can claim it at once
   * (the live tenant fans four AP uplinks into one such `port1.0.5`).
   */
  zportdn?: string
  /** 1 LLDP, 2 side-by-side, 3 MACARP, 4 CDP, 5 IP, 6 Eth-Trunk, 99 manual. */
  linktype?: number
  /**
   * 0 normal, 1 unknown, 2 major, 3 critical, 4 offline, 5 unmanaged, 6 faulty.
   *
   * Verified against a live tenant: the two links whose AP was up read 0, the
   * seven whose AP was offline read 4. The controller keeps a link record after
   * its endpoint goes away — with no timestamp — so this field (with
   * `anestate` / `znestate`) is the only way to tell a live wire from one that
   * was merely observed at some point in the past.
   */
  linkstatus?: number
  /** A-end / Z-end NE state: 0 unmanaged, 1 online, 2 offline, 3 unknown. */
  anestate?: number
  znestate?: number
  /** Link speed in Mbit/s, as a string. */
  speed?: string
}

/** Envelope of `GET /rest/openapi/network/link`. */
export interface NceNetworkLinkResponse {
  /** 0 = success. */
  code?: number
  description?: string
  data?: NceNetworkLink[]
  /** Total links matching the query. */
  size?: number
  totalPage?: number
}

// ----- Performance ----------------------------------------------------------

/**
 * One record from `GET .../basicperformance/device/{deviceId}`.
 * `status`: 0 = normal, 1 = alarm, 2 = faulty, 3 = offline, 4 = unregistered.
 */
export interface NceDevicePerformance {
  id?: string
  name?: string
  esn?: string
  deviceIp?: string
  neType?: string
  status?: number
  /** Total traffic volume, bytes. */
  traffic?: number
  /** Number of connected terminals. */
  onlineUsers?: number
  /** CPU usage, percent. */
  cpuRate?: number
  /** Memory usage, percent. */
  memoryRate?: number
  upwardSpeed?: number
  downwardSpeed?: number
  mac?: string
  timestamp?: number
}

/** Envelope of `GET .../basicperformance/device/{deviceId}`. */
export interface NceDevicePerformanceResponse {
  errcode?: string
  errmsg?: string
  data?: NceDevicePerformance[]
}

/** Per-interface counters from `GET .../interfaceperformance/device/{deviceId}`. */
export interface NceInterfacePerformance {
  interfaceName?: string
  /** Bandwidth usage in the outbound direction (percent, as a string). */
  outBandwidth?: string
  /** Bandwidth usage in the inbound direction (percent, as a string). */
  inputBandwidth?: string
  /** Uplink traffic, incremental bytes over the last collection period. */
  upwardTraffic?: number
  /** Downlink traffic, incremental bytes over the last collection period. */
  downwardTraffic?: number
}

/** Envelope of `GET .../interfaceperformance/device/{deviceId}`. */
export interface NceInterfacePerformanceResponse {
  errcode?: string
  errmsg?: string
  data?: Array<{
    mac?: string
    interfacePackets?: NceInterfacePerformance | NceInterfacePerformance[]
  }>
}

// ----- Alarms ---------------------------------------------------------------

/**
 * One current alarm from `POST /v1/perfservice/alarms/current-alarms/action/scroll`.
 * `alarmLevel`: 1 = critical, 2 = major, 3 = minor, 4 = warning.
 * `cleared`: 0 = uncleared, 1 = cleared.
 */
export interface NceAlarm {
  csn?: string
  alarmName?: string
  alarmLevel?: number
  alarmId?: string
  alarmResId?: string
  alarmResName?: string
  /** Last occurrence time — epoch milliseconds, as a string. */
  latestOccurUtc?: string
  alarmCategory?: string
  additionalInformation?: string
  cleared?: number
  probableCause?: string
  repairAction?: string
  alarmGroupId?: string
}

/** Envelope of the current-alarm scroll endpoint. */
export interface NceAlarmScrollResponse {
  errcode?: string
  errmsg?: string
  /** Opaque cursor; pass back to fetch the next batch. */
  iterator?: string
  data?: NceAlarm[]
}
