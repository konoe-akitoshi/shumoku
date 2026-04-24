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
    stroke-linecap: butt;
    stroke-dasharray: var(--wm-dash, 3 21);
    opacity: var(--wm-opacity, 0.95);
    animation-duration: var(--wm-duration, 2s);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: var(--wm-play, paused);
  }
  .wm-overlay[data-direction="in"]  { animation-name: wm-flow-in; }
  .wm-overlay[data-direction="out"] { animation-name: wm-flow-out; }
  /* 'reduced' mode: solid lane at reduced opacity, no animated dots */
  .wm-overlay.wm-static {
    stroke-dasharray: none;
    animation: none;
    opacity: 0.7;
  }
  /* When a link has live metrics, tint the base pipe with the same
     utilization color used by its flow lanes. The CSS variable is
     set by WeathermapController on the link-group at apply() time.
     SVG attribute 'stroke' is overridable by CSS, so no !important
     or inline-style mutation is needed. */
  .wm-active > path.link {
    stroke: var(--wm-base-color, currentColor);
    opacity: 0.55;
    transition: stroke 200ms ease, opacity 200ms ease;
  }
  /* "in" animates forward along the path (source → destination);
     "out" animates the opposite way. SVG stroke-dashoffset decreases
     to shift the dash pattern forward along the drawn direction, and
     increases to shift it backward. */
  @keyframes wm-flow-in  { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }
  @keyframes wm-flow-out { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 24; } }
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

export type WeathermapAnimationMode = 'full' | 'reduced'

export class WeathermapController {
  private svg: SVGSVGElement
  private layer: SVGGElement | null = null
  private entries = new Map<string, OverlayEntry>()
  private animationMode: WeathermapAnimationMode = 'full'

  constructor(svg: SVGSVGElement) {
    this.svg = svg
    ensureStyle()
  }

  /**
   * Control animation fidelity. 'reduced' drops the dotted flow
   * animation and shows only solid utilization-colored lanes — useful
   * for small widgets where the animation is more noise than signal.
   */
  setAnimationMode(mode: WeathermapAnimationMode): void {
    if (this.animationMode === mode) return
    this.animationMode = mode
    // Re-apply styling on existing overlays so the mode switch takes
    // effect immediately without waiting for the next metrics update.
    for (const entry of this.entries.values()) {
      entry.in.classList.toggle('wm-static', mode === 'reduced')
      entry.out.classList.toggle('wm-static', mode === 'reduced')
    }
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
      const baseWidth = Number(origPath.getAttribute('stroke-width') ?? '2')
      // Both flow lanes live *inside* the base pipe: centered at
      // ±(base/4) with thickness base/2 each, so the two lanes
      // together span exactly the pipe's stroke range. The 2px
      // floor keeps very thin links (default/type='thick') visible.
      const laneWidth = Math.max(baseWidth / 2, 2)
      const laneOffset = baseWidth / 4

      let entry = this.entries.get(linkId)
      if (!entry || entry.pathD !== pathD) {
        entry?.in.remove()
        entry?.out.remove()
        const inPath = this.createPath(createOffsetPathD(origPath, laneOffset), 'in', laneWidth)
        const outPath = this.createPath(createOffsetPathD(origPath, -laneOffset), 'out', laneWidth)
        layer.appendChild(inPath)
        layer.appendChild(outPath)
        entry = { in: inPath, out: outPath, pathD, group }
        this.entries.set(linkId, entry)
      }

      const down = metrics.status === 'down'
      const inUtil = metrics.inUtilization ?? metrics.utilization ?? 0
      const outUtil = metrics.outUtilization ?? metrics.utilization ?? 0
      // Tint the base pipe with the heavier direction's utilization
      // color so the line itself signals load at a glance — the
      // animated dots inside then carry the direction + volume.
      const baseColor = down ? DOWN_COLOR : getUtilizationColor(Math.max(inUtil, outUtil))
      group.classList.add('wm-active')
      ;(group as SVGGElement).style.setProperty('--wm-base-color', baseColor)

      applyDirection(
        entry.in,
        down ? DOWN_COLOR : getUtilizationColor(inUtil),
        metrics.inBps ?? 0,
        laneWidth,
        down,
      )
      applyDirection(
        entry.out,
        down ? DOWN_COLOR : getUtilizationColor(outUtil),
        metrics.outBps ?? 0,
        laneWidth,
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

  private ensureLayer(): SVGGElement | null {
    if (this.layer?.isConnected) return this.layer
    // `.viewport` is the d3-zoom-transformed group that @shumoku/renderer
    // renders inside its <svg>. Appending overlays here ensures they
    // follow pan/zoom with the rest of the diagram.
    const viewport = this.svg.querySelector('.viewport')
    if (!viewport) return null
    this.layer = document.createElementNS(SVG_NS, 'g')
    this.layer.setAttribute('class', 'wm-overlay-layer')
    // Place overlays between base edges and nodes so animated flow
    // sits on the link lane, not on top of nodes / ports / labels.
    // ShumokuRenderer draws children in this order inside .viewport:
    //   canvas-bg → subgraphs → edges (link-groups) → nodes → ports
    // We insert before the first node so we end up right after the
    // last edge in stacking order.
    const firstNode = viewport.querySelector('g.node')
    if (firstNode) {
      viewport.insertBefore(this.layer, firstNode)
    } else {
      viewport.appendChild(this.layer)
    }
    return this.layer
  }

  private createPath(d: string, direction: 'in' | 'out', laneWidth: number): SVGPathElement {
    const p = document.createElementNS(SVG_NS, 'path')
    p.setAttribute('class', `wm-overlay${this.animationMode === 'reduced' ? ' wm-static' : ''}`)
    p.setAttribute('data-direction', direction)
    p.setAttribute('d', d)
    p.style.setProperty('--wm-width', String(laneWidth))
    return p
  }

  private removeEntry(linkId: string, entry: OverlayEntry): void {
    entry.in.remove()
    entry.out.remove()
    entry.group.classList.remove('wm-active')
    ;(entry.group as SVGGElement).style.removeProperty('--wm-base-color')
    this.entries.delete(linkId)
  }
}

function applyDirection(
  path: SVGPathElement,
  color: string,
  bps: number,
  width: number,
  down: boolean,
): void {
  path.style.setProperty('--wm-color', color)
  path.style.setProperty('--wm-width', String(width))
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
