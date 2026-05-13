/**
 * Structural shape accepted by WeathermapLinkOverlay. Looser than
 * `@shumoku/core`'s `LinkMetrics` so the dashboard's richer statuses
 * (e.g. 'degraded') flow through — we only branch on 'down'.
 *
 * Direction note: `inBps` / `outBps` (and the `*Utilization` variants)
 * are data-source-defined. The overlay renders them as two visually
 * distinct lanes flowing in opposite directions, but does NOT claim
 * either lane corresponds to `fromPort → toPort`. Plugins are expected
 * to be consistent within themselves; cross-plugin direction semantics
 * are not unified.
 */
export interface LinkFlowMetrics {
  status: string
  utilization?: number
  inUtilization?: number
  outUtilization?: number
  inBps?: number
  outBps?: number
}

// --- Utilization → color ---

const UTILIZATION_COLORS: readonly (readonly [number, string])[] = [
  [0, '#6b7280'],
  [1, '#22c55e'],
  [25, '#84cc16'],
  [50, '#eab308'],
  [75, '#f97316'],
  [90, '#ef4444'],
  [100, '#dc2626'],
]
export const DOWN_COLOR = '#ef4444'
const NO_DATA_COLOR = '#6b7280'

export function getUtilizationColor(utilization: number): string {
  // NaN/Infinity would silently fall through every `<=` comparison and
  // land on DOWN_COLOR (red). Treat bad input as "no data" (gray).
  if (!Number.isFinite(utilization)) return NO_DATA_COLOR
  const u = Math.max(0, Math.min(100, utilization))
  for (const [max, color] of UTILIZATION_COLORS) {
    if (u <= max) return color
  }
  // Unreachable given the clamp + 100 ceiling, but keeps the return type total.
  return DOWN_COLOR
}

// --- Bandwidth/utilization → animation duration ---

// log10(bps) denominator: 11 puts 100 Gbps at full speed, covering modern
// link rates. Previously 9 saturated at ~1 Gbps so 10G/100G all looked alike.
const BPS_LOG_DENOM = 11
const DURATION_MIN_MS = 400
const DURATION_MAX_MS = 2000

function speedToDurationMs(speed01: number): number {
  const s = Math.max(0, Math.min(1, speed01))
  return DURATION_MIN_MS + (DURATION_MAX_MS - DURATION_MIN_MS) * (1 - s)
}

export function bpsToDurationMs(bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0
  const speed = Math.log10(bps + 1) / BPS_LOG_DENOM
  return speedToDurationMs(speed)
}

/**
 * Fallback for data sources that report utilization but not bps. Maps
 * 0–100% to the same duration band as `bpsToDurationMs`, so the visual
 * speed scale stays comparable.
 */
export function utilizationToDurationMs(util: number): number {
  if (!Number.isFinite(util) || util <= 0) return 0
  return speedToDurationMs(util / 100)
}
