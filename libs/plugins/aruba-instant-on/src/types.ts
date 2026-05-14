/**
 * Aruba Instant On plugin types.
 *
 * Field names mirror the responses returned by the (undocumented) portal
 * API, so they sometimes use camelCase strings the API picked. Optional on
 * everything except the bits we actually rely on — schemas drift.
 */

export interface ArubaInstantOnConfig {
  /** Portal account email. The account must NOT have MFA enabled. */
  username: string
  /** Portal account password. Stored alongside other plugin configs. */
  password: string
  /**
   * Limit polling to a specific site id. Omit to poll all sites the
   * account can see (typical SMB tenant has 1–N sites).
   */
  siteId?: string
}

// ----- API response shapes (subsets — fields we touch) ---------------------

export interface AruSite {
  id: string
  name: string
}

export interface AruSitesResponse {
  elements: AruSite[]
}

export interface AruInventoryDevice {
  /** Primary id used by the portal (typically the MAC). */
  id?: string
  serialNumber?: string
  macAddress?: string
  /** Display name (operator-assigned). Falls back to `defaultName` (e.g. "CNJ6K9T736"). */
  name?: string
  defaultName?: string
  /** Device category: 'accessPoint' / 'switch' / 'gateway'. */
  deviceType?: string
  /** Model code, e.g. "AP-303", "JL678A". */
  model?: string
  /** Per-device status. Observed values: 'up', 'down' (lowercase). */
  status?: string
  operationalState?: string
  /** Health summary: 'good' / 'poor' etc. */
  health?: string
  ipAddress?: string
  /** Seconds since the portal last heard from the device. Used to derive lastSeen. */
  numberOfSecondsSinceLastCommunication?: number
  /** Alerts the portal currently has open against this device. */
  activeAlerts?: AruEmbeddedAlert[]
}

/** Subset of the alert shape embedded in inventory device records. */
export interface AruEmbeddedAlert {
  id: string
  type?: string
  severity?: string
  /** Unix seconds. */
  raisedTime?: number
  /** Unix seconds; null when still active. */
  clearedTime?: number | null
  alertTypeProperties?: {
    deviceNames?: string[]
    deviceIds?: string[]
  }
}

export interface AruInventoryResponse {
  elements: AruInventoryDevice[]
}

export interface AruAlertItem {
  /** Stable id for the alert (used as our Alert.id). */
  id?: string
  /** Human-readable description. */
  description?: string
  /** Aruba's severity label — mapped to our AlertSeverity in plugin.ts. */
  severity?: string
  /** ISO timestamp when the alert opened. */
  startTime?: string
  /** ISO timestamp when it closed (null/missing → still active). */
  endTime?: string
  /** Device serial / MAC that the alert relates to, when known. */
  deviceSerial?: string
  deviceName?: string
}

export interface AruAlertsResponse {
  elements: AruAlertItem[]
}
