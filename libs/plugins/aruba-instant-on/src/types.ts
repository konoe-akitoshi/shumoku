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
  serialNumber?: string
  macAddress?: string
  /** Display name (operator-assigned). */
  name?: string
  /** "AP", "SW", possibly others — used to classify topology nodes later. */
  productLine?: string
  /** Model string, e.g. "AP22", "JL678A". */
  modelName?: string
  /** Per-device status. Known values: "ACTIVE", "INACTIVE", "OFFLINE". */
  status?: string
  ipAddress?: string
  /** ISO timestamp of last seen — used as `lastSeen` ms in NodeMetrics. */
  lastUpdated?: string
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
