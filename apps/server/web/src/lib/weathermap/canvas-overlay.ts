/**
 * Canvas overlay renderer for particle animation.
 *
 * Replaces per-element SVG stroke-dashoffset animations with a single
 * requestAnimationFrame loop that draws all particles onto one <canvas>.
 * This avoids per-element SVG re-rasterization and CSS filter costs.
 *
 * Performance techniques:
 * - Color-batched path drawing (medium): one beginPath/fill per color group
 * - Pre-rendered glow sprites (high): drawImage with cached offscreen canvas
 * - CTM caching: getScreenCTM() only called when transform changes
 * - Viewport culling: particles outside canvas bounds are skipped
 */

// --- Types ---

interface Point {
  x: number
  y: number
}

export interface ParticleTrack {
  points: Point[]
  /** Cumulative distance at each point (for binary search). */
  distances: number[]
  totalLength: number
  /** Current animation offset in SVG units (0..totalLength). */
  offset: number
  /** Speed in SVG-units per millisecond. */
  speed: number
  /** +1 = forward (out), -1 = reverse (in). */
  direction: 1 | -1
  color: string
  active: boolean
}

type QualityTier = 'high' | 'medium' | 'low'

// --- Path sampling ---

/**
 * Sample an SVG path into a polyline at the given normal offset.
 * Returns the same shape as `createOffsetPathD()` but as Point[] + distances[].
 */
export function samplePathToPolyline(
  path: SVGPathElement,
  offset: number,
  sampleInterval: number,
  minSamples: number,
): { points: Point[]; distances: number[]; totalLength: number } {
  const len = path.getTotalLength()
  if (len === 0) {
    const p = path.getPointAtLength(0)
    return { points: [{ x: p.x, y: p.y }], distances: [0], totalLength: 0 }
  }

  const start = path.getPointAtLength(0)
  const end = path.getPointAtLength(len)

  // Detect straight line (same heuristic as createOffsetPathD)
  const mid = path.getPointAtLength(len / 2)
  const deviation =
    Math.abs(mid.x - (start.x + end.x) / 2) + Math.abs(mid.y - (start.y + end.y) / 2)

  let rawPoints: Point[]

  if (deviation < 1) {
    // Straight line — only two points needed
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const nx = -Math.sin(angle) * offset
    const ny = Math.cos(angle) * offset
    rawPoints = [
      { x: start.x + nx, y: start.y + ny },
      { x: end.x + nx, y: end.y + ny },
    ]
  } else {
    // Curved path — sample along normals
    const numSamples = Math.max(minSamples, Math.ceil(len / sampleInterval))
    rawPoints = []
    for (let i = 0; i <= numSamples; i++) {
      const t = (i / numSamples) * len
      const p = path.getPointAtLength(t)
      const dt = Math.min(1, len * 0.001)
      const p1 = path.getPointAtLength(Math.max(0, t - dt))
      const p2 = path.getPointAtLength(Math.min(len, t + dt))
      const a = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      rawPoints.push({
        x: p.x - Math.sin(a) * offset,
        y: p.y + Math.cos(a) * offset,
      })
    }
  }

  // Build cumulative distances
  const distances: number[] = [0]
  let cumDist = 0
  for (let i = 1; i < rawPoints.length; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x
    const dy = rawPoints[i].y - rawPoints[i - 1].y
    cumDist += Math.sqrt(dx * dx + dy * dy)
    distances.push(cumDist)
  }

  return { points: rawPoints, distances, totalLength: cumDist }
}

// --- Interpolation ---

/** Binary-search distances[] to find the XY position at a given offset. */
function getPointAtOffset(track: ParticleTrack, offset: number): Point {
  const { points, distances } = track
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]

  // Clamp
  if (offset <= 0) return points[0]
  if (offset >= track.totalLength) return points[points.length - 1]

  // Binary search for the segment
  let lo = 0
  let hi = distances.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (distances[mid] <= offset) lo = mid
    else hi = mid
  }

  const segLen = distances[hi] - distances[lo]
  if (segLen === 0) return points[lo]

  const t = (offset - distances[lo]) / segLen
  return {
    x: points[lo].x + (points[hi].x - points[lo].x) * t,
    y: points[lo].y + (points[hi].y - points[lo].y) * t,
  }
}

// --- Canvas Overlay Renderer ---

const PARTICLE_SPACING = 24 // SVG units between particles
const PARTICLE_RADIUS_SVG = 3 // base radius in SVG units (scales with zoom)
const MIN_RADIUS_PX = 1.5 // minimum screen-pixel radius (prevents subpixel)
const DT_CLAMP = 100 // max ms per frame to prevent jumps on tab switch

/**
 * Pre-render a glowing particle sprite onto an offscreen canvas.
 * Avoids per-frame Gaussian blur from ctx.shadowBlur.
 */
function createGlowSprite(radius: number, color: string): CanvasImageSource {
  const blur = radius * 1.5
  const size = Math.ceil((radius + blur) * 2)
  const offscreen = document.createElement('canvas')
  offscreen.width = size
  offscreen.height = size
  const ctx = offscreen.getContext('2d')!
  ctx.shadowBlur = blur
  ctx.shadowColor = color
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2)
  ctx.fill()
  return offscreen
}

export class CanvasOverlayRenderer {
  private svg: SVGSVGElement
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private quality: QualityTier
  private dpr: number
  private tracks: ParticleTrack[] = []
  private rafId: number | null = null
  private lastTime: number | null = null
  private running = false
  private frozen = false
  private resizeObserver: ResizeObserver
  /** Cached glow sprites keyed by color. Invalidated when scale changes. */
  private spriteCache = new Map<string, { img: CanvasImageSource; size: number }>()
  private lastSpriteScale = 0
  /** Cached CTM to avoid forcing layout recalc every frame. */
  private cachedMatrix: DOMMatrix | null = null
  private ctmDirty = true

  constructor(svg: SVGSVGElement, quality: QualityTier) {
    this.svg = svg
    this.quality = quality
    this.dpr = window.devicePixelRatio || 1

    // Insert canvas into the fixed container (grandparent of SVG), NOT the
    // panzoom-transformed wrapper (parent of SVG). The wrapper moves with
    // pan/zoom CSS transforms, but the canvas must stay fixed — we handle
    // the coordinate mapping ourselves via getScreenCTM().
    const wrapper = svg.parentElement!
    this.container = wrapper.parentElement ?? wrapper
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;'
    this.container.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!
    this.syncSize()

    // Track container resizes
    this.resizeObserver = new ResizeObserver(() => this.syncSize())
    this.resizeObserver.observe(this.container)
  }

  setTracks(tracks: ParticleTrack[]): void {
    this.tracks = tracks
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = null
    this.scheduleFrame()
  }

  /** Freeze animation offsets but keep rendering (for pan/zoom tracking). */
  freeze(): void {
    this.frozen = true
    this.invalidateTransform()
  }

  /** Resume animation offset advancement. */
  unfreeze(): void {
    this.frozen = false
    this.lastTime = null
    this.invalidateTransform()
  }

  /** Mark the cached CTM as stale (call on pan/zoom events). */
  invalidateTransform(): void {
    this.ctmDirty = true
  }

  /** Stop the render loop entirely (for cleanup). */
  pause(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.lastTime = null
  }

  resume(): void {
    if (this.running) return
    this.start()
  }

  destroy(): void {
    this.pause()
    this.resizeObserver.disconnect()
    this.canvas.remove()
    this.tracks = []
  }

  // --- Internals ---

  private syncSize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = w * this.dpr
    this.canvas.height = h * this.dpr
    this.ctmDirty = true
  }

  private scheduleFrame(): void {
    if (!this.running) return
    this.rafId = requestAnimationFrame((now) => this.frame(now))
  }

  private frame(now: number): void {
    if (!this.running) return

    // Advance animation offsets only when not frozen (pan/zoom in progress)
    if (!this.frozen) {
      const dt = this.lastTime !== null ? Math.min(now - this.lastTime, DT_CLAMP) : 0
      this.lastTime = now
      for (const track of this.tracks) {
        if (!track.active || track.totalLength === 0) continue
        track.offset =
          (((track.offset + dt * track.speed * track.direction) % track.totalLength) +
            track.totalLength) %
          track.totalLength
      }
    }

    // Clear
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Refresh CTM only when dirty (pan/zoom changed)
    if (this.ctmDirty) {
      this.cachedMatrix = this.computeTransformToCanvas()
      this.ctmDirty = false
    }
    const matrix = this.cachedMatrix
    if (!matrix) {
      this.scheduleFrame()
      return
    }

    // Compute the SVG→screen scale factor from the CTM
    const scale = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b)
    // Radius in SVG units: scales with zoom, but clamped to minimum screen size
    const radiusSvg = Math.max(PARTICLE_RADIUS_SVG, (MIN_RADIUS_PX * this.dpr) / scale)

    const useSprites = this.quality === 'high'

    // Invalidate sprite cache when scale changes significantly
    if (useSprites && Math.abs(scale - this.lastSpriteScale) / (this.lastSpriteScale || 1) > 0.2) {
      this.spriteCache.clear()
      this.lastSpriteScale = scale
    }

    // Viewport bounds for culling (in canvas buffer pixels)
    const cw = canvas.width
    const ch = canvas.height

    if (useSprites) {
      // Draw pre-rendered glow sprites in screen coordinates (no setTransform)
      const { a, b, c, d, e, f } = matrix
      const screenRadius = radiusSvg * scale

      for (const track of this.tracks) {
        if (!track.active || track.totalLength === 0) continue

        const sprite = this.getSprite(track.color, screenRadius)
        const halfSize = sprite.size / 2

        const numParticles = Math.ceil(track.totalLength / PARTICLE_SPACING)
        for (let i = 0; i < numParticles; i++) {
          const dist = (track.offset + i * PARTICLE_SPACING) % track.totalLength
          const pt = getPointAtOffset(track, dist)
          const cx = a * pt.x + c * pt.y + e
          const cy = b * pt.x + d * pt.y + f
          // Viewport culling
          if (cx + halfSize < 0 || cx - halfSize > cw || cy + halfSize < 0 || cy - halfSize > ch)
            continue
          ctx.drawImage(sprite.img, cx - halfSize, cy - halfSize)
        }
      }
    } else {
      // Medium quality: color-batched filled circles via setTransform (no glow).
      // Group particles by color → one beginPath/fill per color group.
      ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f)

      // Precompute inverse-scale margin for SVG-space viewport culling
      const margin = radiusSvg
      const invA = matrix.d / (matrix.a * matrix.d - matrix.b * matrix.c)
      const invD = matrix.a / (matrix.a * matrix.d - matrix.b * matrix.c)
      // Conservative SVG-space bounds (axis-aligned, ignoring rotation for speed)
      const svgMinX = -matrix.e * invA - margin
      const svgMaxX = (cw - matrix.e) * invA + margin
      const svgMinY = -matrix.f * invD - margin
      const svgMaxY = (ch - matrix.f) * invD + margin

      // Collect colors in use
      const colorGroups = new Map<string, ParticleTrack[]>()
      for (const track of this.tracks) {
        if (!track.active || track.totalLength === 0) continue
        const group = colorGroups.get(track.color)
        if (group) group.push(track)
        else colorGroups.set(track.color, [track])
      }

      for (const [color, tracks] of colorGroups) {
        ctx.fillStyle = color
        ctx.beginPath()

        for (const track of tracks) {
          const numParticles = Math.ceil(track.totalLength / PARTICLE_SPACING)
          for (let i = 0; i < numParticles; i++) {
            const dist = (track.offset + i * PARTICLE_SPACING) % track.totalLength
            const pt = getPointAtOffset(track, dist)
            // Viewport culling in SVG space
            if (pt.x < svgMinX || pt.x > svgMaxX || pt.y < svgMinY || pt.y > svgMaxY) continue
            ctx.moveTo(pt.x + radiusSvg, pt.y)
            ctx.arc(pt.x, pt.y, radiusSvg, 0, Math.PI * 2)
          }
        }

        ctx.fill()
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    this.scheduleFrame()
  }

  private getSprite(color: string, screenRadius: number): { img: CanvasImageSource; size: number } {
    const cached = this.spriteCache.get(color)
    if (cached) return cached
    const img = createGlowSprite(screenRadius, color)
    const size = (img as HTMLCanvasElement).width
    const entry = { img, size }
    this.spriteCache.set(color, entry)
    return entry
  }

  /**
   * Build the SVG-coordinate → canvas-pixel transform.
   *
   * `svg.getScreenCTM()` gives SVG-user-units → screen-pixels (including
   * any CSS transform from panzoom). We subtract the container's screen
   * position and multiply by devicePixelRatio to get canvas-buffer coords.
   */
  private computeTransformToCanvas(): DOMMatrix | null {
    const ctm = this.svg.getScreenCTM()
    if (!ctm) return null
    const rect = this.container.getBoundingClientRect()
    const dpr = this.dpr
    return new DOMMatrix([
      ctm.a * dpr,
      ctm.b * dpr,
      ctm.c * dpr,
      ctm.d * dpr,
      (ctm.e - rect.left) * dpr,
      (ctm.f - rect.top) * dpr,
    ])
  }
}
