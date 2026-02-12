/**
 * Weathermap — overlay-based in/out dual-path rendering for SVG link groups.
 *
 * Original SVG paths are hidden via opacity. Overlay paths are created on top
 * with `pointer-events: none` so they don't interfere with interactions.
 *
 * Each original path produces an in/out pair:
 *   1. Base line (SVG) — solid stroke at reduced opacity showing utilization color
 *   2. Particle track (Canvas) — animated dots drawn by CanvasOverlayRenderer
 */

import { CanvasOverlayRenderer, samplePathToPolyline, type ParticleTrack } from './canvas-overlay'

// --- Types ---

interface LinkMetrics {
  status: string
  utilization?: number
  inUtilization?: number
  outUtilization?: number
  inBps?: number
  outBps?: number
}

interface DirectionLayer {
  base: SVGPathElement
  track: ParticleTrack
}

/** N original paths × 2 directions = 2N overlay pairs. */
interface LinkOverlay {
  inLayers: DirectionLayer[]
  outLayers: DirectionLayer[]
  origPaths: SVGPathElement[]
  group: Element
  ready: boolean
  pending: boolean
}

// --- Constants ---

const SVG_NS = 'http://www.w3.org/2000/svg'
const NEUTRAL_COLOR = '#6b7280'
const DOWN_COLOR = '#ef4444'

const UTILIZATION_COLORS = [
  { max: 0, color: NEUTRAL_COLOR },
  { max: 1, color: '#22c55e' },
  { max: 25, color: '#84cc16' },
  { max: 50, color: '#eab308' },
  { max: 75, color: '#f97316' },
  { max: 90, color: '#ef4444' },
  { max: 100, color: '#dc2626' },
]

// --- Helpers ---

export function getUtilizationColor(utilization: number): string {
  for (const t of UTILIZATION_COLORS) {
    if (utilization <= t.max) return t.color
  }
  return '#dc2626'
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function allLayers(overlay: LinkOverlay): DirectionLayer[] {
  return [...overlay.inLayers, ...overlay.outLayers]
}

// --- Offset-path geometry ---

function createOffsetPathD(
  path: SVGPathElement,
  offset: number,
  sampleInterval: number,
  minSamples: number,
): string {
  const len = path.getTotalLength()
  if (len === 0) return path.getAttribute('d') || ''

  // Fast path: straight lines don't need sampling.
  const start = path.getPointAtLength(0)
  const end = path.getPointAtLength(len)
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const nx = -Math.sin(angle) * offset
  const ny = Math.cos(angle) * offset

  const mid = path.getPointAtLength(len / 2)
  const deviation =
    Math.abs(mid.x - (start.x + end.x) / 2) + Math.abs(mid.y - (start.y + end.y) / 2)

  if (deviation < 1) {
    return (
      `M ${(start.x + nx).toFixed(2)} ${(start.y + ny).toFixed(2)}` +
      ` L ${(end.x + nx).toFixed(2)} ${(end.y + ny).toFixed(2)}`
    )
  }

  // Curved path: sample and offset along normals.
  const numSamples = Math.max(minSamples, Math.ceil(len / sampleInterval))
  const points: string[] = []

  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * len
    const p = path.getPointAtLength(t)
    const dt = Math.min(1, len * 0.001)
    const p1 = path.getPointAtLength(Math.max(0, t - dt))
    const p2 = path.getPointAtLength(Math.min(len, t + dt))
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x)

    points.push(
      `${(p.x - Math.sin(a) * offset).toFixed(2)} ${(p.y + Math.cos(a) * offset).toFixed(2)}`,
    )
  }

  return (
    `M ${points[0]}` +
    points
      .slice(1)
      .map((p) => ` L ${p}`)
      .join('')
  )
}

// --- WeathermapController ---

type QualityTier = 'high' | 'medium' | 'low'

interface OriginalStyle {
  stroke: string | null
  opacity: string
  strokeDasharray: string
}

export class WeathermapController {
  private svg: SVGSVGElement
  private overlays = new Map<string, LinkOverlay>()
  private originalStyles = new Map<SVGPathElement, OriginalStyle>()
  private overlayQueue: LinkOverlay[] = []
  private idleHandle: number | null = null
  private quality: QualityTier
  private sampleInterval: number
  private minSamples: number
  private batchSize: number
  private animationsEnabled: boolean
  private lastLinks: Record<string, LinkMetrics> | undefined
  private canvasRenderer: CanvasOverlayRenderer | null = null

  constructor(svg: SVGSVGElement) {
    this.svg = svg
    const { quality, sampleInterval, minSamples, batchSize, animationsEnabled } =
      this.detectQualityTier()
    this.quality = quality
    this.sampleInterval = sampleInterval
    this.minSamples = minSamples
    this.batchSize = batchSize
    this.animationsEnabled = animationsEnabled

    if (this.animationsEnabled) {
      this.canvasRenderer = new CanvasOverlayRenderer(svg, this.quality)
      this.canvasRenderer.start()
    }
  }

  apply(links: Record<string, LinkMetrics> | undefined): void {
    this.lastLinks = links
    const svgRect = this.svg.getBoundingClientRect()
    const viewportQueue: LinkOverlay[] = []
    const deferredQueue: LinkOverlay[] = []

    for (const group of this.svg.querySelectorAll('g.link-group')) {
      const linkId = group.getAttribute('data-link-id') || ''
      const metrics = links?.[linkId]
      const origPaths = Array.from(
        group.querySelectorAll('path.link:not(.wm-overlay)'),
      ) as SVGPathElement[]
      if (origPaths.length === 0) continue

      const overlay = this.ensureOverlayRecord(linkId, group, origPaths)

      if (overlay.ready) {
        this.applyOverlay(overlay, metrics)
        this.hideOriginalPaths(origPaths)
      } else {
        this.applyLowToOriginalPaths(origPaths, metrics)
        this.enqueueOverlayCreation(
          overlay,
          this.isInViewport(group, svgRect) ? viewportQueue : deferredQueue,
        )
      }
    }

    if (viewportQueue.length || deferredQueue.length) {
      this.overlayQueue = [
        ...viewportQueue,
        ...this.overlayQueue.filter((overlay) => overlay.pending),
        ...deferredQueue,
      ]
      this.scheduleBatch()
    }

    this.syncTracksToCanvas()
  }

  reset(): void {
    if (this.idleHandle !== null) {
      this.cancelIdleCallback(this.idleHandle)
      this.idleHandle = null
    }
    this.overlayQueue = []

    for (const overlay of this.overlays.values()) {
      for (const layer of allLayers(overlay)) {
        layer.base.remove()
      }
    }
    this.overlays.clear()

    this.canvasRenderer?.setTracks([])

    for (const [path, style] of this.originalStyles) {
      if (style.stroke === null) {
        path.removeAttribute('stroke')
      } else {
        path.setAttribute('stroke', style.stroke)
      }
      path.style.opacity = style.opacity
      path.style.strokeDasharray = style.strokeDasharray
    }
    this.originalStyles.clear()
  }

  destroy(): void {
    this.reset()
    this.canvasRenderer?.destroy()
    this.canvasRenderer = null
  }

  setInteracting(isInteracting: boolean): void {
    if (!this.animationsEnabled || !this.canvasRenderer) return
    if (isInteracting) {
      this.canvasRenderer.freeze()
    } else {
      this.canvasRenderer.unfreeze()
    }
  }

  // --- Internals ---

  private detectQualityTier(): {
    quality: QualityTier
    sampleInterval: number
    minSamples: number
    batchSize: number
    animationsEnabled: boolean
  } {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      'matchMedia' in window &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const deviceMemory =
      typeof navigator !== 'undefined' && 'deviceMemory' in navigator
        ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4)
        : 4
    const hardwareConcurrency =
      typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
        ? navigator.hardwareConcurrency || 4
        : 4

    if (deviceMemory <= 2 || hardwareConcurrency <= 2) {
      return {
        quality: 'low',
        sampleInterval: 10,
        minSamples: 14,
        batchSize: 2,
        animationsEnabled: false,
      }
    }

    // prefers-reduced-motion: cap at medium (no glow) but keep animation
    // since traffic flow is explicitly user-enabled
    if (prefersReducedMotion || deviceMemory <= 4 || hardwareConcurrency <= 4) {
      return {
        quality: 'medium',
        sampleInterval: 6,
        minSamples: 22,
        batchSize: 4,
        animationsEnabled: true,
      }
    }

    return {
      quality: 'high',
      sampleInterval: 4,
      minSamples: 30,
      batchSize: 6,
      animationsEnabled: true,
    }
  }

  private ensureOverlayRecord(
    linkId: string,
    group: Element,
    origPaths: SVGPathElement[],
  ): LinkOverlay {
    const existing = this.overlays.get(linkId)
    if (existing) return existing

    const overlay: LinkOverlay = {
      inLayers: [],
      outLayers: [],
      origPaths,
      group,
      ready: false,
      pending: false,
    }
    this.overlays.set(linkId, overlay)
    return overlay
  }

  private enqueueOverlayCreation(overlay: LinkOverlay, queue: LinkOverlay[]): void {
    if (overlay.ready || overlay.pending) return
    overlay.pending = true
    queue.push(overlay)
  }

  private scheduleBatch(): void {
    if (this.idleHandle !== null || this.overlayQueue.length === 0) return

    const handler = (deadline?: IdleDeadline) => {
      this.idleHandle = null
      this.processBatch(deadline)
      if (this.overlayQueue.length > 0) this.scheduleBatch()
    }

    if ('requestIdleCallback' in window) {
      this.idleHandle = (window as any).requestIdleCallback(handler, { timeout: 100 })
    } else {
      this.idleHandle = (globalThis as any).setTimeout(() => handler(undefined), 16) as number
    }
  }

  private cancelIdleCallback(handle: number): void {
    if ('cancelIdleCallback' in window) {
      ;(window as any).cancelIdleCallback(handle)
    } else {
      clearTimeout(handle)
    }
  }

  private processBatch(deadline?: IdleDeadline): void {
    const start = performance.now()
    let processed = 0

    while (this.overlayQueue.length > 0) {
      const overlay = this.overlayQueue.shift()
      if (!overlay) break

      overlay.pending = false
      if (!overlay.group.isConnected) continue

      this.buildOverlay(overlay)
      processed += 1

      if (processed >= this.batchSize) break
      if (deadline && deadline.timeRemaining() < 4) break
      if (!deadline && performance.now() - start > 8) break
    }

    this.syncTracksToCanvas()
  }

  private buildOverlay(overlay: LinkOverlay): void {
    if (overlay.ready) return

    const { origPaths, group } = overlay
    const strokeWidth = Number(origPaths[0]?.getAttribute('stroke-width') || '2')
    const sw = String(strokeWidth)
    const offset = strokeWidth / 2
    const inLayers: DirectionLayer[] = []
    const outLayers: DirectionLayer[] = []

    for (const origPath of origPaths) {
      if (!origPath.isConnected) continue

      // Base line (SVG, static)
      const inBaseD = createOffsetPathD(origPath, offset, this.sampleInterval, this.minSamples)
      const outBaseD = createOffsetPathD(origPath, -offset, this.sampleInterval, this.minSamples)

      // Particle tracks (for Canvas animation)
      const inTrackData = samplePathToPolyline(
        origPath,
        offset,
        this.sampleInterval,
        this.minSamples,
      )
      const outTrackData = samplePathToPolyline(
        origPath,
        -offset,
        this.sampleInterval,
        this.minSamples,
      )

      inLayers.push({
        base: this.createBasePath(inBaseD, sw),
        track: {
          ...inTrackData,
          offset: 0,
          speed: 0,
          direction: -1,
          color: NEUTRAL_COLOR,
          active: false,
        },
      })

      outLayers.push({
        base: this.createBasePath(outBaseD, sw),
        track: {
          ...outTrackData,
          offset: 0,
          speed: 0,
          direction: 1,
          color: NEUTRAL_COLOR,
          active: false,
        },
      })
    }

    overlay.inLayers = inLayers
    overlay.outLayers = outLayers

    // Only append base paths to SVG (no dots elements)
    for (const layer of allLayers(overlay)) {
      group.appendChild(layer.base)
    }

    overlay.ready = true

    const linkId = group.getAttribute('data-link-id') || ''
    const metrics = this.lastLinks?.[linkId]
    this.applyOverlay(overlay, metrics)
    this.hideOriginalPaths(origPaths)
  }

  private createBasePath(d: string, strokeWidth: string): SVGPathElement {
    const base = svgEl('path', {
      d,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-width': strokeWidth,
    })
    base.classList.add('wm-overlay')
    base.style.pointerEvents = 'none'
    base.style.opacity = '0.4'
    return base
  }

  private applyOverlay(overlay: LinkOverlay, metrics?: LinkMetrics): void {
    if (metrics?.status === 'down') {
      this.applyDown(overlay)
      return
    }

    if (!metrics) {
      this.applyLow(overlay)
      return
    }

    this.applyDirectional(overlay, metrics)
  }

  private applyLow(overlay: LinkOverlay, metrics?: LinkMetrics): void {
    const util = this.resolveUtilization(metrics)
    const color = metrics?.status === 'down' ? DOWN_COLOR : getUtilizationColor(util)
    for (const layer of allLayers(overlay)) {
      this.setStroke(layer.base, color)
      layer.base.style.opacity = '0.4'
      if (layer.base.style.strokeDasharray) layer.base.style.strokeDasharray = ''

      layer.track.active = false
      layer.track.color = color
    }
  }

  private applyDown(overlay: LinkOverlay): void {
    for (const layer of allLayers(overlay)) {
      this.setStroke(layer.base, DOWN_COLOR)
      layer.base.style.opacity = '0.4'
      layer.base.style.strokeDasharray = '8 4'

      layer.track.active = false
      layer.track.color = DOWN_COLOR
    }
  }

  private applyDirectional(overlay: LinkOverlay, metrics?: LinkMetrics): void {
    const inUtil = metrics?.inUtilization ?? metrics?.utilization ?? 0
    const outUtil = metrics?.outUtilization ?? metrics?.utilization ?? 0
    const inBps = metrics?.inBps ?? 0
    const outBps = metrics?.outBps ?? 0

    for (const layer of overlay.inLayers) this.styleDirection(layer, inUtil, inBps, true)
    for (const layer of overlay.outLayers) this.styleDirection(layer, outUtil, outBps, false)
  }

  private styleDirection(layer: DirectionLayer, util: number, bps: number, isIn: boolean): void {
    const color = getUtilizationColor(util)

    this.setStroke(layer.base, color)
    layer.base.style.opacity = '0.4'
    if (layer.base.style.strokeDasharray) layer.base.style.strokeDasharray = ''

    layer.track.color = color

    if (bps > 0 && this.animationsEnabled) {
      // Convert bps to speed in SVG-units/ms (same curve as before)
      const speedFactor = Math.min(1, Math.log10(bps + 1) / 9)
      const durationSec = Math.max(0.3, 2 - speedFactor * 1.5)
      // 24 SVG units (particle spacing) per cycle
      layer.track.speed = 24 / (durationSec * 1000)
      layer.track.direction = isIn ? -1 : 1
      layer.track.active = true
    } else {
      layer.track.active = false
      layer.track.speed = 0
    }
  }

  /** Collect all tracks from overlays and push to the canvas renderer. */
  private syncTracksToCanvas(): void {
    if (!this.canvasRenderer) return
    const tracks: ParticleTrack[] = []
    for (const overlay of this.overlays.values()) {
      if (!overlay.ready) continue
      for (const layer of allLayers(overlay)) {
        tracks.push(layer.track)
      }
    }
    this.canvasRenderer.setTracks(tracks)
  }

  private setStroke(el: SVGPathElement, color: string): void {
    if (el.getAttribute('stroke') !== color) el.setAttribute('stroke', color)
  }

  private resolveUtilization(metrics?: LinkMetrics): number {
    if (!metrics) return 0
    if (metrics.utilization !== undefined) return metrics.utilization
    const inUtil = metrics.inUtilization ?? 0
    const outUtil = metrics.outUtilization ?? 0
    return Math.max(inUtil, outUtil)
  }

  private rememberOriginalStyle(path: SVGPathElement): void {
    if (this.originalStyles.has(path)) return
    this.originalStyles.set(path, {
      stroke: path.getAttribute('stroke'),
      opacity: path.style.opacity,
      strokeDasharray: path.style.strokeDasharray,
    })
  }

  private applyLowToOriginalPaths(paths: SVGPathElement[], metrics?: LinkMetrics): void {
    const util = this.resolveUtilization(metrics)
    const color = metrics?.status === 'down' ? DOWN_COLOR : getUtilizationColor(util)
    const dash = metrics?.status === 'down' ? '8 4' : ''

    for (const path of paths) {
      this.rememberOriginalStyle(path)
      path.setAttribute('stroke', color)
      path.style.opacity = '0.6'
      path.style.strokeDasharray = dash
    }
  }

  private hideOriginalPaths(paths: SVGPathElement[]): void {
    for (const path of paths) {
      this.rememberOriginalStyle(path)
      path.style.opacity = '0'
    }
  }

  private isInViewport(group: Element, svgRect: DOMRect): boolean {
    const rect = group.getBoundingClientRect()
    return !(
      rect.right < svgRect.left ||
      rect.left > svgRect.right ||
      rect.bottom < svgRect.top ||
      rect.top > svgRect.bottom
    )
  }
}
