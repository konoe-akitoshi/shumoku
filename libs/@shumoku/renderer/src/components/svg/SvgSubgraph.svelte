<script lang="ts">
  import type { Subgraph, SurfaceToken, Theme } from '@shumoku/core'
  import type { SubgraphOverlaySnippet } from '../../lib/overlays'
  import type { RenderColors } from '../../lib/render-colors'
  import { elementDrag } from '../../lib/use-drag'

  let {
    subgraph,
    colors,
    theme,
    selected = false,
    bumping = false,
    interactive = false,
    overlay,
    ondragstart,
    ondragmove,
    ondragend,
    onselect,
    oncontextmenu: onctx,
    preventContextMenuDefault = true,
  }: {
    subgraph: Subgraph
    colors: RenderColors
    theme?: Theme
    selected?: boolean
    /** True when another element is being dragged against this
     *  subgraph — surfaces a red outline as drag-time feedback. */
    bumping?: boolean
    interactive?: boolean
    overlay?: SubgraphOverlaySnippet
    ondragstart?: (sgId: string) => void
    ondragmove?: (sgId: string, x: number, y: number) => void
    ondragend?: (sgId: string) => void
    /** Click / right-click on this subgraph. Receives the original event so
     *  the renderer can read modifier keys for additive multi-selection. */
    onselect?: (sgId: string, e?: MouseEvent) => void
    oncontextmenu?: (id: string, e: MouseEvent) => void
    preventContextMenuDefault?: boolean
  } = $props()

  const style = $derived(subgraph.style ?? {})
  const surfaceTokens: readonly string[] = [
    'surface-1',
    'surface-2',
    'surface-3',
    'accent-blue',
    'accent-green',
    'accent-red',
    'accent-amber',
    'accent-purple',
  ]

  const resolved = $derived(() => {
    const fillValue = style.fill
    const strokeValue = style.stroke
    if (fillValue && surfaceTokens.includes(fillValue) && theme) {
      const sc = theme.colors.surfaces[fillValue as SurfaceToken]
      return { fill: sc.fill, stroke: strokeValue ?? sc.stroke, text: sc.text }
    }
    return {
      fill: fillValue ?? colors.subgraphFill,
      stroke: strokeValue ?? colors.subgraphStroke,
      text: colors.subgraphText,
    }
  })

  const strokeWidth = $derived(style.strokeWidth ?? 3)
  const strokeDasharray = $derived(style.strokeDasharray ?? '')
  const overlayContext = $derived({
    selected,
    interactive,
    bounds: {
      x: subgraph.bounds?.x ?? 0,
      y: subgraph.bounds?.y ?? 0,
      width: subgraph.bounds?.width ?? 0,
      height: subgraph.bounds?.height ?? 0,
    },
  })
</script>

<g class="subgraph" class:selected class:bumping data-id={subgraph.id}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <rect
    class="subgraph-bg"
    x={subgraph.bounds?.x ?? 0}
    y={subgraph.bounds?.y ?? 0}
    width={subgraph.bounds?.width ?? 0}
    height={subgraph.bounds?.height ?? 0}
    rx="12"
    ry="12"
    fill={resolved().fill}
    stroke={selected ? '#3b82f6' : resolved().stroke}
    stroke-width={selected ? 3 : strokeWidth}
    stroke-dasharray={selected ? undefined : (strokeDasharray || undefined)}
    onclick={(e) => { e.stopPropagation(); onselect?.(subgraph.id, e) }}
    oncontextmenu={(e) => { if (preventContextMenuDefault) e.preventDefault(); onselect?.(subgraph.id, e); onctx?.(subgraph.id, e) }}
    use:elementDrag={() => ({
      filter: (e) => e.button === 0 && interactive,
      onStart: () => ondragstart?.(subgraph.id),
      onDrag: (dx, dy) => ondragmove?.(subgraph.id, (subgraph.bounds?.x ?? 0) + dx, (subgraph.bounds?.y ?? 0) + dy),
      onEnd: () => ondragend?.(subgraph.id),
    })}
  />
  {@render overlay?.(subgraph, overlayContext)}
  <text
    x={(subgraph.bounds?.x ?? 0) + 10}
    y={(subgraph.bounds?.y ?? 0) + 20}
    class="subgraph-label"
    text-anchor="start"
    fill={resolved().text}
    pointer-events="none"
  >
    {subgraph.label}
  </text>
</g>
