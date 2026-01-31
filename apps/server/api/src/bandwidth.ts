/**
 * Bandwidth string to capacity (bps) conversion.
 *
 * Shared across server components that need to convert bandwidth labels
 * like "1G", "10G" to numeric bits-per-second values.
 */

const bandwidthMap: Record<string, number> = {
  '100M': 100_000_000,
  '1G': 1_000_000_000,
  '10G': 10_000_000_000,
  '25G': 25_000_000_000,
  '40G': 40_000_000_000,
  '100G': 100_000_000_000,
}

/** Default capacity when bandwidth is unspecified. */
export const DEFAULT_CAPACITY = 1_000_000_000 // 1 Gbps

/**
 * Convert a bandwidth string (e.g. "1G", "10G") to bits per second.
 * Returns `undefined` if the string is not recognized.
 */
export function parseBandwidthCapacity(bandwidth?: string): number | undefined {
  return bandwidth ? bandwidthMap[bandwidth] : undefined
}

/**
 * Convert a bandwidth string to bits per second, falling back to 1 Gbps.
 */
export function getBandwidthCapacity(bandwidth?: string): number {
  return parseBandwidthCapacity(bandwidth) ?? DEFAULT_CAPACITY
}
