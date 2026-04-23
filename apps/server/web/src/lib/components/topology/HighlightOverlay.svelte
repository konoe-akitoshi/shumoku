<script lang="ts">
  /**
   * HighlightOverlay — adds `.node-highlighted` (and optionally
   * `.node-dimmed` on peers) to matching nodes. Also supports
   * attribute-based matching ('show all L3 switches').
   *
   * Exposes both a reactive prop-driven API (pass `highlightedIds` /
   * `attributeMatch` in) and an imperative handle (`bind:this`) so
   * event-driven callers (dashboard widget events) can call
   * `.applyIds(...)` / `.applyAttribute(...)` / `.clear()` directly.
   */

  interface AttributeMatch {
    key: string
    value: string
  }

  interface Props {
    svgElement: SVGSVGElement | null
    /** Reactive highlight state. Setting this re-applies. */
    highlightedIds?: ReadonlySet<string> | string[]
    /** Reactive attribute match — wins over `highlightedIds` if both set. */
    attributeMatch?: AttributeMatch
    /** Dim non-highlighted nodes + links when something is highlighted. */
    dimOthers?: boolean
    /** Color applied via `--highlight-color` CSS variable. */
    highlightColor?: string
    /** Pulse animation on matched nodes. Default: true. */
    pulseAnimation?: boolean
  }

  let {
    svgElement,
    highlightedIds,
    attributeMatch,
    dimOthers = false,
    highlightColor,
    pulseAnimation = true,
  }: Props = $props()

  function clear(svg: SVGSVGElement) {
    for (const el of svg.querySelectorAll('.node-highlighted')) {
      el.classList.remove('node-highlighted')
    }
    for (const el of svg.querySelectorAll('.node-dimmed')) {
      el.classList.remove('node-dimmed')
    }
  }

  function applyIds(svg: SVGSVGElement, ids: ReadonlySet<string>): void {
    clear(svg)
    if (ids.size === 0) return
    for (const node of svg.querySelectorAll('g.node[data-id]')) {
      const id = node.getAttribute('data-id')
      if (id && ids.has(id)) {
        node.classList.add('node-highlighted')
      } else if (dimOthers) {
        node.classList.add('node-dimmed')
      }
    }
    if (dimOthers) {
      for (const link of svg.querySelectorAll('g.link-group[data-link-id]')) {
        link.classList.add('node-dimmed')
      }
    }
  }

  function applyAttribute(svg: SVGSVGElement, key: string, value: string): void {
    clear(svg)
    let matched = 0
    for (const node of svg.querySelectorAll('g.node[data-id]')) {
      if (node.getAttribute(key) === value) {
        node.classList.add('node-highlighted')
        matched++
      } else if (dimOthers) {
        node.classList.add('node-dimmed')
      }
    }
    if (matched > 0 && dimOthers) {
      for (const link of svg.querySelectorAll('g.link-group[data-link-id]')) {
        link.classList.add('node-dimmed')
      }
    }
  }

  // Imperative handle for event-driven consumers
  export function apply(ids: Iterable<string>): void {
    if (!svgElement) return
    applyIds(svgElement, new Set(ids))
  }
  export function applyByAttribute(key: string, value: string): void {
    if (!svgElement) return
    applyAttribute(svgElement, key, value)
  }
  export function clearHighlight(): void {
    if (svgElement) clear(svgElement)
  }

  // Reactive prop-driven path
  $effect(() => {
    if (!svgElement) return
    const svg = svgElement

    // `--highlight-color` is picked up by CSS rules on the host
    // container. Scope it to the SVG so the caller doesn't have to
    // wire it up themselves.
    if (highlightColor) {
      svg.style.setProperty('--highlight-color', highlightColor)
    } else {
      svg.style.removeProperty('--highlight-color')
    }
    svg.style.setProperty('--highlight-pulse', pulseAnimation ? 'node-pulse' : 'none')

    if (attributeMatch) {
      applyAttribute(svg, attributeMatch.key, attributeMatch.value)
      return
    }
    if (highlightedIds) {
      const set = highlightedIds instanceof Set ? highlightedIds : new Set(highlightedIds)
      applyIds(svg, set)
      return
    }
    clear(svg)
  })

  $effect(() => {
    return () => {
      if (svgElement) clear(svgElement)
    }
  })
</script>

<!-- Highlight styling is co-located so any consumer of this overlay
     gets the visuals automatically. `--highlight-color` and
     `--highlight-pulse` are set reactively above. -->
<svelte:head>
  {@html `<style id="shumoku-highlight-css">
    g.node.node-highlighted {
      animation: var(--highlight-pulse, node-pulse) 0.5s ease-in-out infinite alternate;
    }
    g.node.node-highlighted rect,
    g.node.node-highlighted circle,
    g.node.node-highlighted path {
      stroke: var(--highlight-color, #f59e0b) !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--highlight-color, #f59e0b) 60%, transparent));
    }
    g.node.node-dimmed,
    g.link-group.node-dimmed {
      opacity: 0.15;
      transition: opacity 0.2s ease;
    }
    @keyframes node-pulse { from { opacity: 1; } to { opacity: 0.7; } }
  </style>`}
</svelte:head>
