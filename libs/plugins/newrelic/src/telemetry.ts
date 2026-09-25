import type { LinkMetrics, NodeMetrics } from '@shumoku/core'
import { fresh, num, type Row, str } from './values.js'
/** No device-state inference from collection health alone. */
export function nodeMetrics(row: Row, now: number, freshness = 180): NodeMetrics {
  const lastSeen = num(row['healthSeen'])
  if (!fresh(lastSeen, now, freshness))
    return {
      status: 'unknown',
      monitoring: 'pending',
      lastSeen,
      monitoringError: 'No recent SNMP collection result',
    }
  if (row['health'] === 'GOOD') {
    if (!fresh(row['usableSeen'], now, freshness))
      return {
        status: 'unknown',
        monitoring: 'pending',
        lastSeen,
        monitoringError: 'Collector heartbeat received, but no recent usable device telemetry',
      }
    return { status: 'unknown', monitoring: 'healthy', lastSeen }
  }
  return {
    status: 'unknown',
    monitoring: 'failing',
    lastSeen,
    monitoringError: str(row['reason']) ?? 'SNMP collection failed',
  }
}

export function linkMetrics(
  row: Row,
  now: number,
  bandwidth?: number,
  freshness = 180,
): LinkMetrics {
  if (!fresh(row['stateSeen'], now, freshness)) return { status: 'unknown' }
  const status =
    row['oper'] === 'up'
      ? 'up'
      : row['oper'] === 'down' || row['oper'] === 'lowerLayerDown'
        ? 'down'
        : 'unknown'
  const result: LinkMetrics = { status }
  const speed = bandwidth ?? (num(row['speed']) ?? 0) * 1_000_000
  for (const direction of ['in', 'out'] as const) {
    if (!fresh(row[`${direction}Seen`], now, freshness)) continue
    const bps = num(row[`${direction}Bps`])
    if (bps === undefined || bps < 0) continue
    result[`${direction}Bps`] = bps
    if (speed > 0) result[`${direction}Utilization`] = Math.min(100, (bps / speed) * 100)
  }
  return result
}
