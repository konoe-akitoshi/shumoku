<script lang="ts">
  /**
   * NodeStatusOverlay — visualises two orthogonal signals per node:
   *
   *   1. Device status   → `status-{up,down,warning,degraded,unknown}` class
   *                        on `g.node`. Styled via the node-bg rect border.
   *   2. Monitoring path → `monitoring-{healthy,failing,pending,paused}`
   *                        class + an injected corner badge so it doesn't
   *                        compete with the device status for visual real
   *                        estate.
   *
   * The two are independent — a node can be `status-up` (data flowing) and
   * `monitoring-paused` (operator put it in maintenance), for instance.
   */

  interface NodeMetricsLike {
    status: string
    monitoring?: string
  }

  interface Props {
    svgElement: SVGSVGElement | null
    status: Record<string, NodeMetricsLike> | undefined
    enabled?: boolean
    /** Extra status values beyond up/down/unknown (e.g. 'warning'). */
    allowedStatuses?: readonly string[]
  }

  const DEFAULT_STATUSES: readonly string[] = ['up', 'down', 'unknown', 'warning', 'degraded']
  const MONITORING_STATES: readonly string[] = ['healthy', 'failing', 'pending', 'paused']
  const BADGE_CLASS = 'shumoku-monitoring-badge'
  const SVG_NS = 'http://www.w3.org/2000/svg'

  let { svgElement, status, enabled = true, allowedStatuses = DEFAULT_STATUSES }: Props = $props()

  function clearNode(node: Element) {
    for (const s of allowedStatuses) node.classList.remove(`status-${s}`)
    for (const m of MONITORING_STATES) node.classList.remove(`monitoring-${m}`)
    node.querySelector(`g.${BADGE_CLASS}`)?.remove()
  }

  function clearAll(svg: SVGSVGElement) {
    for (const node of svg.querySelectorAll('g.node')) clearNode(node)
  }

  /**
   * Place a small status dot at the top-right of the node's bounding rect.
   * Idempotent: re-uses an existing badge so we don't accumulate elements
   * across re-renders. Hidden by default; CSS shows it when the parent has
   * a non-healthy `monitoring-*` class.
   */
  function ensureBadge(node: Element): void {
    const rect = node.querySelector<SVGRectElement>('.node-bg rect')
    if (!rect) return
    const x = Number.parseFloat(rect.getAttribute('x') ?? '0')
    const y = Number.parseFloat(rect.getAttribute('y') ?? '0')
    const w = Number.parseFloat(rect.getAttribute('width') ?? '0')

    let badge = node.querySelector<SVGGElement>(`g.${BADGE_CLASS}`)
    if (!badge) {
      badge = document.createElementNS(SVG_NS, 'g')
      badge.setAttribute('class', BADGE_CLASS)
      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('r', '5')
      badge.appendChild(circle)
      node.appendChild(badge)
    }
    badge.setAttribute('transform', `translate(${x + w - 4}, ${y + 4})`)
  }

  $effect(() => {
    if (!svgElement) return
    const svg = svgElement

    if (!enabled || !status) {
      clearAll(svg)
      return
    }

    clearAll(svg)
    for (const [id, meta] of Object.entries(status)) {
      const el = svg.querySelector(`g.node[data-id="${CSS.escape(id)}"]`)
      if (!el) continue
      if (allowedStatuses.includes(meta.status)) {
        el.classList.add(`status-${meta.status}`)
      }
      if (meta.monitoring && MONITORING_STATES.includes(meta.monitoring)) {
        el.classList.add(`monitoring-${meta.monitoring}`)
        // Always draw the badge — visual structure stays consistent across
        // nodes, so the operator's eye is trained on the same spot.
        ensureBadge(el)
      }
    }

    return () => clearAll(svg)
  })
</script>

<!-- Status-class + monitoring-badge styling co-located so any consumer that
     mounts this overlay gets the visuals automatically. -->
<svelte:head>
  {@html `<style id="shumoku-node-status-css">
    /* === Device status (border on the node-bg rect) ===
       Suppressed when the node is selected so the renderer's selection
       stroke (passed via the SVG attribute) stays visible — without this,
       a colored node clicked by the operator gives no visual feedback. */
    g.node.status-up:not(.selected) .node-bg rect {
      stroke: #22c55e;
      stroke-width: 2px;
    }
    g.node.status-down:not(.selected) .node-bg rect {
      stroke: #ef4444;
      stroke-width: 2.5px;
      filter: drop-shadow(0 0 6px color-mix(in srgb, #ef4444 60%, transparent));
      animation: shumoku-status-down-pulse 1.6s ease-in-out infinite alternate;
    }
    g.node.status-warning:not(.selected) .node-bg rect {
      stroke: #f97316;
      stroke-width: 2px;
    }
    g.node.status-degraded:not(.selected) .node-bg rect {
      stroke: #eab308;
      stroke-width: 2px;
    }
    g.node.status-unknown:not(.selected) .node-bg rect {
      stroke: #6b7280;
      stroke-width: 2px;
      stroke-dasharray: 4 3;
    }
    /* === Monitoring path (small corner badge) ===
       Separate from device status so a node can be e.g. status-up +
       monitoring-paused without one signal overwriting the other. */
    g.node g.shumoku-monitoring-badge { pointer-events: none; }
    g.node g.shumoku-monitoring-badge circle {
      stroke: #ffffff;
      stroke-width: 1.5;
    }
    g.node.monitoring-healthy g.shumoku-monitoring-badge circle { fill: #22c55e; }
    g.node.monitoring-failing g.shumoku-monitoring-badge circle { fill: #ef4444; }
    g.node.monitoring-pending g.shumoku-monitoring-badge circle { fill: #9ca3af; }
    g.node.monitoring-paused g.shumoku-monitoring-badge circle { fill: #3b82f6; }
    @keyframes shumoku-status-down-pulse {
      from { opacity: 1; }
      to   { opacity: 0.55; }
    }
    /* Camera gesture LOD (see attachCamera): freeze the pulse and drop
       the glow filter while panning/zooming so down-status nodes don't
       force full-SVG repaints mid-gesture. */
    svg.camera-gesture g.node.status-down .node-bg rect {
      animation-play-state: paused;
      filter: none;
    }
    @media (prefers-reduced-motion: reduce) {
      g.node.status-down .node-bg rect { animation: none; }
    }
    @media print {
      g.node[class*="status-"] .node-bg rect {
        stroke: unset !important;
        stroke-width: unset !important;
        filter: none !important;
        animation: none !important;
      }
      g.node g.shumoku-monitoring-badge { display: none; }
    }
  </style>`}
</svelte:head>
