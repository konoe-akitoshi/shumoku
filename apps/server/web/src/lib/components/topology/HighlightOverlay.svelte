<script lang="ts">
  /**
   * HighlightOverlay — marks nodes (`.node-highlighted`), each in its own colour, and optionally
   * dims the rest (`.node-dimmed`). Marked nodes in `fresh` (what is new) beat with a glow
   * (`.node-new`), also where the steady pulse is off, so a new alert stands out from the ones
   * already known. Purely prop-driven: what is passed now is what is shown.
   */

  interface Props {
    svgElement: SVGSVGElement | null
    /** Node id → its colour (`undefined`: the default highlight colour). */
    marks?: ReadonlyMap<string, string | undefined>
    /** Dim the nodes and links that are not marked, while any node is. */
    dimOthers?: boolean
    /** Pulse the marked nodes. Default: true. */
    pulseAnimation?: boolean
    /** Marked nodes that are new: they beat with a glow until they leave this set. */
    fresh?: ReadonlySet<string>
  }

  let { svgElement, marks, dimOthers = false, pulseAnimation = true, fresh }: Props = $props()

  function clear(svg: SVGSVGElement) {
    for (const el of svg.querySelectorAll<SVGElement>('.node-highlighted')) {
      el.classList.remove('node-highlighted', 'node-new')
      el.style.removeProperty('--highlight-color')
    }
    for (const el of svg.querySelectorAll('.node-dimmed')) {
      el.classList.remove('node-dimmed')
    }
  }

  $effect(() => {
    if (!svgElement) return
    const svg = svgElement
    svg.style.setProperty('--highlight-pulse', pulseAnimation ? 'node-pulse' : 'none')
    clear(svg)
    if (!marks || marks.size === 0) return
    for (const node of svg.querySelectorAll<SVGGElement>('g.node[data-id]')) {
      const id = node.getAttribute('data-id')
      if (id && marks.has(id)) {
        node.classList.add('node-highlighted')
        if (fresh?.has(id)) node.classList.add('node-new')
        const color = marks.get(id)
        if (color) node.style.setProperty('--highlight-color', color)
      } else if (dimOthers) {
        node.classList.add('node-dimmed')
      }
    }
    if (dimOthers) {
      for (const link of svg.querySelectorAll('g.link-group[data-link-id]')) {
        link.classList.add('node-dimmed')
      }
    }
  })

  $effect(() => {
    // Capture the svg reference at effect-run time. Reading the prop
    // in the teardown can throw if the parent's snippet context has
    // already been torn down (the prop getter dereferences a now-null
    // context). An unhandled error during navigation teardown causes
    // SvelteKit to fall back to a full page reload.
    const svg = svgElement
    return () => {
      if (svg?.isConnected) clear(svg)
    }
  })
</script>

<!-- Highlight styling is co-located so any consumer of this overlay
     gets the visuals automatically. `--highlight-color` is set per node and
     `--highlight-pulse` on the SVG, above. -->
<svelte:head>
  {@html `<style id="shumoku-highlight-css">
    g.node.node-highlighted,
    g.node.node-focused {
      animation: var(--highlight-pulse, node-pulse) 0.5s ease-in-out infinite alternate;
    }
    g.node.node-highlighted rect,
    g.node.node-highlighted circle,
    g.node.node-highlighted path,
    g.node.node-focused rect,
    g.node.node-focused circle,
    g.node.node-focused path {
      stroke: var(--highlight-color, #f59e0b) !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--highlight-color, #f59e0b) 60%, transparent));
    }
    g.node.node-dimmed,
    g.link-group.node-dimmed {
      opacity: 0.15;
      transition: opacity 0.2s ease;
    }
    g.node.node-highlighted.node-new {
      animation: node-new-beat 1.2s ease-in-out infinite;
    }
    g.node.node-highlighted.node-new rect,
    g.node.node-highlighted.node-new circle,
    g.node.node-highlighted.node-new path {
      stroke-width: 5px !important;
    }
    @keyframes node-pulse { from { opacity: 1; } to { opacity: 0.7; } }
    @keyframes node-new-beat {
      0%, 100% { filter: drop-shadow(0 0 2px var(--highlight-color, #f59e0b)); }
      50% { filter: drop-shadow(0 0 18px var(--highlight-color, #f59e0b)); }
    }
    @media (prefers-reduced-motion: reduce) {
      g.node.node-highlighted.node-new { animation: none; }
    }
  </style>`}
</svelte:head>
