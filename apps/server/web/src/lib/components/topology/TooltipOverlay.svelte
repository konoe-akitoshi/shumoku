<script lang="ts">
  /**
   * TooltipOverlay — hover tooltips for topology elements. Delegates
   * hit detection via SVG event listeners (data-id / data-link-id /
   * data-sheet-id attributes). Content is fully customizable via the
   * `content` snippet or a `contentBuilder` function.
   *
   * Kept visual-only — no interaction side effects. Pair with the
   * parent's click handlers for selection.
   */
  import type { NetworkGraph } from '@shumoku/core'
  import type { Snippet } from 'svelte'

  export type ElementKind = 'node' | 'subgraph' | 'link'

  export interface HoveredElement {
    kind: ElementKind
    id: string
    screenX: number
    screenY: number
  }

  interface Props {
    svgElement: SVGSVGElement | null
    graph: NetworkGraph
    enabled?: boolean
    /** Hover delay in ms before tooltip shows. Default 200. */
    delay?: number
    /** Max tooltip width in px (defaults to 300). */
    maxWidth?: number
    /**
     * Render the tooltip body. Receives the hovered element; falls
     * back to a default label-only body if omitted.
     */
    content?: Snippet<[{ hovered: HoveredElement; graph: NetworkGraph }]>
    /**
     * String-based fallback when you don't need a snippet. Returns
     * HTML (sanitized caller responsibility) or plain text.
     */
    contentBuilder?: (hovered: HoveredElement, graph: NetworkGraph) => string
  }

  let {
    svgElement,
    graph,
    enabled = true,
    delay = 200,
    maxWidth = 300,
    content,
    contentBuilder,
  }: Props = $props()

  let hovered = $state<HoveredElement | null>(null)
  let pos = $state({ x: 0, y: 0 })
  let showTimer: ReturnType<typeof setTimeout> | null = null

  function classify(target: EventTarget | null): HoveredElement | null {
    if (!(target instanceof Element)) return null
    const node = target.closest<SVGGElement>('g.node[data-id]')
    if (node)
      return {
        kind: 'node',
        id: node.getAttribute('data-id') ?? '',
        screenX: 0,
        screenY: 0,
      }
    const sg = target.closest<SVGGElement>('g.subgraph[data-id]')
    if (sg)
      return {
        kind: 'subgraph',
        id: sg.getAttribute('data-id') ?? '',
        screenX: 0,
        screenY: 0,
      }
    const link = target.closest<SVGGElement>('g.link-group[data-link-id]')
    if (link)
      return {
        kind: 'link',
        id: link.getAttribute('data-link-id') ?? '',
        screenX: 0,
        screenY: 0,
      }
    return null
  }

  function defaultLabel(h: HoveredElement): string {
    if (h.kind === 'node') {
      const n = graph.nodes.find((x) => x.id === h.id)
      return n?.label && typeof n.label === 'string' ? n.label : h.id
    }
    if (h.kind === 'subgraph') {
      const sg = graph.subgraphs?.find((x) => x.id === h.id)
      return sg?.label ?? h.id
    }
    if (h.kind === 'link') {
      const l = graph.links.find((x) => x.id === h.id)
      const label = l?.label
      return typeof label === 'string' ? label : Array.isArray(label) ? label.join(' / ') : h.id
    }
    return h.id
  }

  $effect(() => {
    if (!svgElement || !enabled) return
    const svg = svgElement
    const ctrl = new AbortController()
    const { signal } = ctrl

    let currentId: string | null = null

    svg.addEventListener(
      'mouseover',
      (e: MouseEvent) => {
        const hit = classify(e.target)
        if (!hit) return
        if (hit.id === currentId) return
        currentId = hit.id

        if (showTimer) clearTimeout(showTimer)
        showTimer = setTimeout(() => {
          hovered = { ...hit, screenX: e.clientX, screenY: e.clientY }
          pos = { x: e.clientX + 12, y: e.clientY + 12 }
        }, delay)
      },
      { signal },
    )

    svg.addEventListener(
      'mouseout',
      (e: MouseEvent) => {
        const related = e.relatedTarget as Element | null
        if (related && svg.contains(related)) {
          const next = classify(related)
          if (next && next.id === currentId) return
        }
        currentId = null
        if (showTimer) {
          clearTimeout(showTimer)
          showTimer = null
        }
        hovered = null
      },
      { signal },
    )

    svg.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (hovered) pos = { x: e.clientX + 12, y: e.clientY + 12 }
      },
      { signal },
    )

    return () => {
      if (showTimer) clearTimeout(showTimer)
      ctrl.abort()
      hovered = null
    }
  })
</script>

{#if hovered}
  <div
    class="tooltip"
    style:left="{pos.x}px"
    style:top="{pos.y}px"
    style:max-width="{maxWidth}px"
    role="tooltip"
  >
    {#if content}
      {@render content({ hovered, graph })}
    {:else if contentBuilder}
      {@html contentBuilder(hovered, graph)}
    {:else}
      <div class="default-body">{defaultLabel(hovered)}</div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    background: var(--color-bg-elevated, #1f2937);
    color: var(--color-text, #f9fafb);
    border: 1px solid var(--border, #374151);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  .default-body {
    font-weight: 500;
  }
</style>
