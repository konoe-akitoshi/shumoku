/**
 * Weathermap — client-side in/out dual-path rendering for SVG link groups.
 *
 * When Traffic Flow is enabled, each link is split into two parallel paths
 * (in / out) that are independently colored and animated based on metrics.
 *
 * For links that already have 2+ SVG paths (e.g. 10G bandwidth), the existing
 * paths are reused. For single-path links the path is dynamically cloned and
 * offset to create the parallel pair.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkMetrics {
  status: string
  utilization?: number
  inUtilization?: number
  outUtilization?: number
  inBps?: number
  outBps?: number
}

interface SavedPathStyle {
  stroke: string
  strokeDasharray: string
  d: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Perpendicular offset (px) from the centerline for each split path. */
const OFFSET_PX = 3

/** Approximate sample interval (px) when generating offset paths. */
const SAMPLE_INTERVAL = 4

/** Minimum number of samples for offset-path generation. */
const MIN_SAMPLES = 30

// ---------------------------------------------------------------------------
// Utilization color scale
// ---------------------------------------------------------------------------

const utilizationColors = [
  { max: 0, color: '#6b7280' },
  { max: 1, color: '#22c55e' },
  { max: 25, color: '#84cc16' },
  { max: 50, color: '#eab308' },
  { max: 75, color: '#f97316' },
  { max: 90, color: '#ef4444' },
  { max: 100, color: '#dc2626' },
]

export function getUtilizationColor(utilization: number): string {
  for (const t of utilizationColors) {
    if (utilization <= t.max) return t.color
  }
  return '#dc2626'
}

// ---------------------------------------------------------------------------
// Offset-path geometry
// ---------------------------------------------------------------------------

/**
 * Build a parallel offset path by sampling the original at regular intervals
 * and shifting each point along the local normal.
 *
 * Works for any SVG path shape (lines, arcs, curves).
 */
function createOffsetPathD(path: SVGPathElement, offset: number): string {
  const len = path.getTotalLength()
  if (len === 0) return path.getAttribute('d') || ''

  const numSamples = Math.max(MIN_SAMPLES, Math.ceil(len / SAMPLE_INTERVAL))
  const points: string[] = []

  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * len
    const p = path.getPointAtLength(t)

    // Tangent via central difference
    const dt = Math.min(1, len * 0.001)
    const p1 = path.getPointAtLength(Math.max(0, t - dt))
    const p2 = path.getPointAtLength(Math.min(len, t + dt))
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)

    const x = p.x - Math.sin(angle) * offset
    const y = p.y + Math.cos(angle) * offset
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }

  return `M ${points[0]}` + points.slice(1).map((p) => ` L ${p}`).join('')
}

// ---------------------------------------------------------------------------
// WeathermapController
// ---------------------------------------------------------------------------

/**
 * Manages the lifecycle of weathermap visualisation on a rendered SVG.
 *
 * Usage:
 * ```ts
 * const wm = new WeathermapController(svgElement)
 * wm.apply(metricsData)   // on every metrics tick
 * wm.reset()              // when Traffic Flow is toggled off
 * wm.destroy()            // on component destroy / sheet change
 * ```
 */
export class WeathermapController {
  private svg: SVGSVGElement
  private originals = new Map<string, Map<SVGPathElement, SavedPathStyle>>()
  private clones = new Map<string, SVGPathElement[]>()

  constructor(svg: SVGSVGElement) {
    this.svg = svg
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Apply weathermap colouring + animation to all links. */
  apply(links: Record<string, LinkMetrics> | undefined): void {
    this.saveOriginals()

    const allGroups = this.svg.querySelectorAll('g.link-group')
    allGroups.forEach((group) => {
      const linkId = group.getAttribute('data-link-id') || ''
      const metrics = links?.[linkId]

      let paths = Array.from(group.querySelectorAll('path.link')) as SVGPathElement[]
      if (paths.length === 0) return

      if (metrics?.status === 'down') {
        this.applyDown(paths)
        return
      }

      paths = this.ensureDualPaths(linkId, group, paths)
      this.applyDirectional(paths, metrics)
    })
  }

  /** Remove all weathermap modifications and restore original SVG state. */
  reset(): void {
    // Remove clones
    for (const clones of this.clones.values()) {
      for (const el of clones) el.remove()
    }
    this.clones.clear()

    // Restore originals
    for (const styles of this.originals.values()) {
      for (const [path, saved] of styles) {
        path.setAttribute('stroke', saved.stroke)
        path.setAttribute('d', saved.d)
        path.style.strokeDasharray = saved.strokeDasharray
        path.style.animation = ''
      }
    }
  }

  /** Full cleanup (call on component destroy or sheet switch). */
  destroy(): void {
    this.reset()
    this.originals.clear()
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Snapshot original path attributes once. */
  private saveOriginals(): void {
    if (this.originals.size > 0) return

    this.svg.querySelectorAll('g.link-group').forEach((group) => {
      const linkId = group.getAttribute('data-link-id') || ''
      const styles = new Map<SVGPathElement, SavedPathStyle>()

      group.querySelectorAll('path.link').forEach((el) => {
        const path = el as SVGPathElement
        styles.set(path, {
          stroke: path.getAttribute('stroke') || '',
          strokeDasharray: path.style.strokeDasharray || '',
          d: path.getAttribute('d') || '',
        })
      })
      this.originals.set(linkId, styles)
    })
  }

  /**
   * Ensure at least 2 `path.link` elements exist in a link group.
   * For single-path links, clone and offset to create a parallel pair.
   */
  private ensureDualPaths(
    linkId: string,
    group: Element,
    paths: SVGPathElement[],
  ): SVGPathElement[] {
    if (paths.length >= 2) return paths

    const existing = this.clones.get(linkId)
    if (existing) return [...paths, ...existing]

    const original = paths[0]
    if (!original) return paths

    const clone = original.cloneNode(true) as SVGPathElement
    clone.classList.add('link-clone')

    // Compute both offsets from the original path BEFORE mutating either
    // In (upward flow) = left side, Out (downward flow) = right side
    const inD = createOffsetPathD(original, OFFSET_PX)
    const outD = createOffsetPathD(original, -OFFSET_PX)
    original.setAttribute('d', inD)
    clone.setAttribute('d', outD)

    original.parentElement?.insertBefore(clone, original.nextSibling)
    this.clones.set(linkId, [clone])

    return [original, clone]
  }

  /** Style a down link (red dashed, no animation). */
  private applyDown(paths: SVGPathElement[]): void {
    for (const path of paths) {
      path.setAttribute('stroke', '#ef4444')
      path.style.strokeDasharray = '8 4'
      path.style.animation = ''
    }
  }

  /** Colour and animate the in/out halves of a path array. */
  private applyDirectional(paths: SVGPathElement[], metrics?: LinkMetrics): void {
    const inUtil = metrics?.inUtilization ?? metrics?.utilization ?? 0
    const outUtil = metrics?.outUtilization ?? metrics?.utilization ?? 0
    const inBps = metrics?.inBps ?? 0
    const outBps = metrics?.outBps ?? 0

    const midPoint = Math.ceil(paths.length / 2)

    paths.forEach((path, index) => {
      const isIn = index < midPoint
      const util = isIn ? inUtil : outUtil
      const bps = isIn ? inBps : outBps

      const color = getUtilizationColor(util)
      if (path.getAttribute('stroke') !== color) {
        path.setAttribute('stroke', color)
      }

      if (bps > 0) {
        const speed = Math.min(1, Math.log10(bps + 1) / 9)
        const duration = Math.max(0.3, 2 - speed * 1.5)
        const anim = isIn ? 'shumoku-edge-flow-out' : 'shumoku-edge-flow-in'
        const animValue = `${anim} ${duration.toFixed(2)}s linear infinite`
        if (path.style.animation !== animValue) {
          path.style.strokeDasharray = '16 8'
          path.style.animation = animValue
        }
      } else if (path.style.animation) {
        path.style.strokeDasharray = ''
        path.style.animation = ''
      }
    })
  }
}
