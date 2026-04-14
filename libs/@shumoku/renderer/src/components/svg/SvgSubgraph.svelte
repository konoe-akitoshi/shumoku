<script lang="ts">
  import type { ResolvedSubgraph, SurfaceToken, Theme } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'
  import { elementDrag } from '../../lib/use-drag'

  let {
    subgraph,
    colors,
    theme,
    selected = false,
    ondragmove,
    onselect,
    oncontextmenu: onctx,
  }: {
    subgraph: ResolvedSubgraph
    colors: RenderColors
    theme?: Theme
    selected?: boolean
    ondragmove?: (sgId: string, x: number, y: number) => void
    onselect?: (sgId: string) => void
    oncontextmenu?: (id: string, e: MouseEvent) => void
  } = $props()

  const style = $derived(subgraph.subgraph.style ?? {})
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
</script>

<g class="subgraph" data-id={subgraph.id}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <rect
    class="subgraph-bg"
    x={subgraph.bounds.x}
    y={subgraph.bounds.y}
    width={subgraph.bounds.width}
    height={subgraph.bounds.height}
    rx="12"
    ry="12"
    fill={resolved().fill}
    stroke={selected ? '#3b82f6' : resolved().stroke}
    stroke-width={selected ? 3 : strokeWidth}
    stroke-dasharray={selected ? undefined : (strokeDasharray || undefined)}
    onclick={(e) => { e.stopPropagation(); onselect?.(subgraph.id) }}
    oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); onselect?.(subgraph.id); onctx?.(subgraph.id, e) }}
    use:elementDrag={() => ({
      onDrag: (dx, dy) => ondragmove?.(subgraph.id, subgraph.bounds.x + dx, subgraph.bounds.y + dy),
    })}
  />
  <text
    x={subgraph.bounds.x + 10}
    y={subgraph.bounds.y + 20}
    class="subgraph-label"
    text-anchor="start"
    fill={resolved().text}
    pointer-events="none"
  >
    {subgraph.subgraph.label}
  </text>
</g>
