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
