/**
 * Format traffic in human-readable format (bps to Kbps/Mbps/Gbps)
 */
export function formatTraffic(bps: number): string {
  if (bps < 1000) return `${bps.toFixed(0)} bps`
  if (bps < 1000000) return `${(bps / 1000).toFixed(1)} Kbps`
  if (bps < 1000000000) return `${(bps / 1000000).toFixed(1)} Mbps`
  return `${(bps / 1000000000).toFixed(2)} Gbps`
}
