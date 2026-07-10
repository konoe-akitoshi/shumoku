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

/**
 * Throughput intensity in 0..1 — the "how much is flowing" signal that drives
 * particle DENSITY and brightness (utilization drives color instead). Log-scaled
 * on bps (same denominator as the duration mapping, so speed and density agree),
 * falling back to utilization% when a source reports no bps.
 */
export function flowLevel(bps: number, util: number): number {
  const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0)
  if (Number.isFinite(bps) && bps > 0) return clamp01(Math.log10(bps + 1) / BPS_LOG_DENOM)
  return clamp01(util / 100)
}

// --- Lane geometry (weathermap in/out overlay) ---

/**
 * Below this base stroke width a two-lane split is sub-pixel and reads as
 * noise, so callers render a single centered lane instead.
 */
export const LANE_SPLIT_MIN_WIDTH = 4
/** Center divider as a fraction of the base width (keeps the gap proportional). */
const LANE_GAP_FRACTION = 0.08
const LANE_GAP_MIN = 0.5
const LANE_GAP_MAX = 2

export interface LaneGeometry {
  /** Stroke width of each directional lane. */
  laneWidth: number
  /** Perpendicular offset of each lane's centerline from the base centerline. */
  laneOffset: number
  /** Center divider gap (between the two lanes). */
  gap: number
  /** Width for the single centered lane used when the split is skipped. */
  combinedWidth: number
  /** Whether the width is large enough to split into two directional lanes. */
  canSplit: boolean
}

/**
 * Lane geometry as a PURE FUNCTION of the base link width. The two lanes
 * partition the base stroke: together they occupy `[-W/2, +W/2]` with a gap
 * carved out of the CENTER, so a lane's outer edge lands exactly on the link
 * edge and can never render outside the line. The guarantee
 *
 *     laneOffset + laneWidth/2 === width/2
 *
 * is what `weathermap-geometry.test.ts` locks in — if this math ever drifts
 * (the bug this replaced added the gap OUTWARD, pushing lanes past the edge),
 * the test fails rather than silently overflowing.
 */
export function computeLaneGeometry(width: number): LaneGeometry {
  const w = Number.isFinite(width) && width > 0 ? width : 0
  const gap = Math.max(LANE_GAP_MIN, Math.min(LANE_GAP_MAX, w * LANE_GAP_FRACTION))
  // Partition: laneWidth = (W - gap)/2, laneOffset = (W + gap)/4.
  //   outer edge = laneOffset + laneWidth/2 = (W+gap)/4 + (W-gap)/4 = W/2
  //   inner edge = laneOffset - laneWidth/2 = gap/2  (→ center gap = gap)
  const laneWidth = Math.max((w - gap) / 2, 0.5)
  const laneOffset = (w + gap) / 4
  return {
    laneWidth,
    laneOffset,
    gap,
    combinedWidth: Math.max(w - gap, 1),
    canSplit: w >= LANE_SPLIT_MIN_WIDTH,
  }
}
