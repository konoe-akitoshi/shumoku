/**
 * Weathermap — CSS-animation driven traffic flow overlay.
 *
 * Given a `<svg>` rendered by `@shumoku/renderer`, creates paired in/out
 * overlay paths in a sibling `<g class="wm-overlay-layer">` under the
 * viewport, and drives `stroke-dashoffset` via CSS `@keyframes` whose
 * speed / color are controlled through per-element CSS custom
 * properties. The browser owns the animation loop — no WAAPI, no
 * idleCallback batching, no JS per frame.
 *
 * Pairs with renderer DOM: `g.link-group[data-link-id]` containing a
 * `path.link` with stable `d` / `stroke-width` attributes.
 */

/**
 * Structural shape accepted by `WeathermapController.apply()`. Looser
 * than `@shumoku/core`'s `LinkMetrics` so the dashboard's richer
 * statuses (e.g. 'degraded') flow through — we only branch on 'down'.
 */
export interface LinkFlowMetrics {
  status: string
  utilization?: number
  inUtilization?: number
  outUtilization?: number
  inBps?: number
  outBps?: number
}

// --- CSS injected once per document ---

const STYLE_ID = 'shumoku-weathermap-css'
const FLOW_CSS = `
  .wm-overlay-layer { pointer-events: none; }
  .wm-overlay {
    fill: none;
    stroke: var(--wm-color, currentColor);
    stroke-width: var(--wm-width, 2);
    stroke-linecap: round;
    stroke-dasharray: var(--wm-dash, 3 21);
    opacity: var(--wm-opacity, 0.9);
    filter: drop-shadow(0 0 2px currentColor);
    animation-duration: var(--wm-duration, 2s);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: var(--wm-play, paused);
  }
  .wm-overlay[data-direction="in"]  { animation-name: wm-flow-in; }
  .wm-overlay[data-direction="out"] { animation-name: wm-flow-out; }
  .wm-dimmed > path.link { opacity: 0.3; }
  @keyframes wm-flow-in  { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
  @keyframes wm-flow-out { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }
  @media (prefers-reduced-motion: reduce) {
    .wm-overlay { animation: none !important; }
  }
`

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

export function getUtilizationColor(utilization: number): string {
  for (const [max, color] of UTILIZATION_COLORS) {
    if (utilization <= max) return color
  }
  return DOWN_COLOR
}

function bpsToDurationMs(bps: number): number {
  if (bps <= 0) return 0
  const speed = Math.min(1, Math.log10(bps + 1) / 9)
  return Math.max(300, (2 - speed * 1.5) * 1000)
}

// --- Offset-path geometry (sample path normals to build parallel in/out lanes) ---

function createOffsetPathD(path: SVGPathElement, offset: number): string {
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

// --- Controller ---

const SVG_NS = 'http://www.w3.org/2000/svg'

interface OverlayEntry {
  in: SVGPathElement
  out: SVGPathElement
  pathD: string
  group: Element
}

export class WeathermapController {
  private svg: SVGSVGElement
  private layer: SVGGElement | null = null
  private entries = new Map<string, OverlayEntry>()

  constructor(svg: SVGSVGElement) {
    this.svg = svg
    ensureStyle()
  }

  apply(links: Record<string, LinkFlowMetrics> | undefined): void {
    if (!links || Object.keys(links).length === 0) {
      this.reset()
      return
    }

    const layer = this.ensureLayer()
    if (!layer) return

    const seen = new Set<string>()
    for (const group of this.svg.querySelectorAll('g.link-group')) {
      const linkId = group.getAttribute('data-link-id') ?? ''
      const metrics = links[linkId]
      if (!metrics) continue
      const origPath = group.querySelector('path.link') as SVGPathElement | null
      if (!origPath) continue
      seen.add(linkId)

      const pathD = origPath.getAttribute('d') ?? ''
      const strokeWidth = Number(origPath.getAttribute('stroke-width') ?? '2')
      const offset = strokeWidth / 2

      let entry = this.entries.get(linkId)
      if (!entry || entry.pathD !== pathD) {
        entry?.in.remove()
        entry?.out.remove()
        const inPath = this.createPath(createOffsetPathD(origPath, offset), 'in', strokeWidth)
        const outPath = this.createPath(createOffsetPathD(origPath, -offset), 'out', strokeWidth)
        layer.appendChild(inPath)
        layer.appendChild(outPath)
        entry = { in: inPath, out: outPath, pathD, group }
        this.entries.set(linkId, entry)
      }
      group.classList.add('wm-dimmed')

      const down = metrics.status === 'down'
      const inUtil = metrics.inUtilization ?? metrics.utilization ?? 0
      const outUtil = metrics.outUtilization ?? metrics.utilization ?? 0
      applyDirection(
        entry.in,
        down ? DOWN_COLOR : getUtilizationColor(inUtil),
        metrics.inBps ?? 0,
        down,
      )
      applyDirection(
        entry.out,
        down ? DOWN_COLOR : getUtilizationColor(outUtil),
        metrics.outBps ?? 0,
        down,
      )
    }

    for (const [linkId, entry] of this.entries) {
      if (!seen.has(linkId)) this.removeEntry(linkId, entry)
    }
  }

  reset(): void {
    for (const [linkId, entry] of this.entries) this.removeEntry(linkId, entry)
    this.layer?.remove()
    this.layer = null
  }

  destroy(): void {
    this.reset()
  }

  /**
   * Historical API — the CSS approach doesn't need pause-on-interact,
   * but callers may still invoke this. No-op.
   */
  setInteracting(_isInteracting: boolean): void {}

  private ensureLayer(): SVGGElement | null {
    if (this.layer?.isConnected) return this.layer
    // Prefer `.viewport` (@shumoku/renderer's d3-zoom-transformed group),
    // so overlays follow pan/zoom. Fall back to the svg root for the
    // older renderer-svg pipeline used by InteractiveSvgDiagram
    // (panzoom transforms the svg itself, not a child `.viewport`).
    const parent = this.svg.querySelector('.viewport') ?? this.svg
    this.layer = document.createElementNS(SVG_NS, 'g')
    this.layer.setAttribute('class', 'wm-overlay-layer')
    parent.appendChild(this.layer)
    return this.layer
  }

  private createPath(d: string, direction: 'in' | 'out', strokeWidth: number): SVGPathElement {
    const p = document.createElementNS(SVG_NS, 'path')
    p.setAttribute('class', 'wm-overlay')
    p.setAttribute('data-direction', direction)
    p.setAttribute('d', d)
    p.style.setProperty('--wm-width', String(Math.max(strokeWidth, 3)))
    return p
  }

  private removeEntry(linkId: string, entry: OverlayEntry): void {
    entry.in.remove()
    entry.out.remove()
    entry.group.classList.remove('wm-dimmed')
    this.entries.delete(linkId)
  }
}

function applyDirection(path: SVGPathElement, color: string, bps: number, down: boolean): void {
  path.style.setProperty('--wm-color', color)
  if (down) {
    path.style.setProperty('--wm-dash', '8 4')
    path.style.setProperty('--wm-play', 'paused')
    path.style.setProperty('--wm-duration', '0ms')
    path.style.setProperty('--wm-opacity', '0.5')
    return
  }
  path.style.setProperty('--wm-dash', '3 21')
  path.style.setProperty('--wm-opacity', '0.9')
  const duration = bpsToDurationMs(bps)
  if (duration > 0) {
    path.style.setProperty('--wm-duration', `${duration}ms`)
    path.style.setProperty('--wm-play', 'running')
  } else {
    path.style.setProperty('--wm-play', 'paused')
    path.style.setProperty('--wm-duration', '0ms')
  }
}

function ensureStyle(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = FLOW_CSS
  document.head.appendChild(style)
}
