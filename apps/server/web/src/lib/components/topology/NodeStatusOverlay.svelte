<script lang="ts">
  /**
   * NodeStatusOverlay — paints up/down/unknown status classes onto
   * node <g> elements based on live metrics. Pairs with styling in
   * the host container (e.g. `g.node.status-down .node-bg rect { ... }`).
   *
   * No rendering of its own — this overlay is essentially a reactive
   * classList manager.
   */

  interface NodeMetricsLike {
    status: string
  }

  interface Props {
    svgElement: SVGSVGElement | null
    status: Record<string, NodeMetricsLike> | undefined
    enabled?: boolean
    /** Extra status values beyond up/down/unknown (e.g. 'warning'). */
    allowedStatuses?: readonly string[]
  }

  const DEFAULT_STATUSES: readonly string[] = ['up', 'down', 'unknown', 'warning', 'degraded']

  let { svgElement, status, enabled = true, allowedStatuses = DEFAULT_STATUSES }: Props = $props()

  function clearAll(svg: SVGSVGElement) {
    for (const node of svg.querySelectorAll('g.node')) {
      for (const s of allowedStatuses) node.classList.remove(`status-${s}`)
    }
  }

  $effect(() => {
    if (!svgElement) return
    const svg = svgElement

    if (!enabled || !status) {
      clearAll(svg)
      return
    }

    // Apply current status. Skip over stale classes on nodes that
    // have newly moved into an unknown category.
    clearAll(svg)
    for (const [id, meta] of Object.entries(status)) {
      const el = svg.querySelector(`g.node[data-id="${CSS.escape(id)}"]`)
      if (!el) continue
      if (allowedStatuses.includes(meta.status)) {
        el.classList.add(`status-${meta.status}`)
      }
    }

    // Cleanup on unmount / status change: only strip what we painted.
    return () => clearAll(svg)
  })
</script>

<!-- Status-class styling is co-located here so any consumer that mounts
     this overlay gets the visuals automatically. The selectors target
     the renderer's `g.node > g.node-bg > rect` structure; CSS beats the
     bare `stroke`/`stroke-width` SVG attributes the renderer writes,
     so no inline-style mutation or !important is required here. -->
<svelte:head>
  {@html `<style id="shumoku-node-status-css">
    g.node.status-up .node-bg rect {
      stroke: #22c55e;
      stroke-width: 2px;
    }
    g.node.status-down .node-bg rect {
      stroke: #ef4444;
      stroke-width: 2.5px;
      filter: drop-shadow(0 0 6px color-mix(in srgb, #ef4444 60%, transparent));
      animation: shumoku-status-down-pulse 1.6s ease-in-out infinite alternate;
    }
    g.node.status-warning .node-bg rect {
      stroke: #f97316;
      stroke-width: 2px;
    }
    g.node.status-degraded .node-bg rect {
      stroke: #eab308;
      stroke-width: 2px;
    }
    g.node.status-unknown .node-bg rect {
      stroke: #6b7280;
      stroke-width: 2px;
      stroke-dasharray: 4 3;
    }
    @keyframes shumoku-status-down-pulse {
      from { opacity: 1; }
      to   { opacity: 0.55; }
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
    }
  </style>`}
</svelte:head>
