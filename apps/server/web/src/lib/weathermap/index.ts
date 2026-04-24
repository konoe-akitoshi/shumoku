/**
 * Structural shape accepted by WeathermapLinkOverlay. Looser than
 * `@shumoku/core`'s `LinkMetrics` so the dashboard's richer statuses
 * (e.g. 'degraded') flow through — we only branch on 'down'.
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
const DOWN_COLOR = '#ef4444'
export { DOWN_COLOR }

export function getUtilizationColor(utilization: number): string {
  for (const [max, color] of UTILIZATION_COLORS) {
    if (utilization <= max) return color
  }
  return DOWN_COLOR
}

export function bpsToDurationMs(bps: number): number {
  if (bps <= 0) return 0
  const speed = Math.min(1, Math.log10(bps + 1) / 9)
  return Math.max(300, (2 - speed * 1.5) * 1000)
}

// --- Offset-path geometry (sample path normals to build parallel in/out lanes) ---

export function createOffsetPathD(path: SVGPathElement, offset: number): string {
  const len = path.getTotalLength()
  if (len === 0) return path.getAttribute('d') ?? ''

  const start = path.getPointAtLength(0)
  const end = path.getPointAtLength(len)
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const nx = -Math.sin(angle) * offset
  const ny = Math.cos(angle) * offset

  // Straight segment fast path — no sampling needed.
  const mid = path.getPointAtLength(len / 2)
  const deviation =
    Math.abs(mid.x - (start.x + end.x) / 2) + Math.abs(mid.y - (start.y + end.y) / 2)
  if (deviation < 1) {
    return (
      `M ${(start.x + nx).toFixed(2)} ${(start.y + ny).toFixed(2)}` +
      ` L ${(end.x + nx).toFixed(2)} ${(end.y + ny).toFixed(2)}`
    )
  }

  // Curved path: sample along normals.
  const numSamples = Math.max(30, Math.ceil(len / 4))
  const pts: string[] = []
  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * len
    const p = path.getPointAtLength(t)
    const dt = Math.min(1, len * 0.001)
    const p1 = path.getPointAtLength(Math.max(0, t - dt))
    const p2 = path.getPointAtLength(Math.min(len, t + dt))
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    pts.push(
      `${(p.x - Math.sin(a) * offset).toFixed(2)} ${(p.y + Math.cos(a) * offset).toFixed(2)}`,
    )
  }
  return `M ${pts[0]}${pts
    .slice(1)
    .map((p) => ` L ${p}`)
    .join('')}`
}
