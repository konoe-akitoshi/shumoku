<script lang="ts">
  import type { ResolvedSubgraph, SurfaceToken, Theme } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'

  let {
    subgraph,
    colors,
    theme,
    interactive = false,
  }: {
    subgraph: ResolvedSubgraph
    colors: RenderColors
    theme?: Theme
    interactive?: boolean
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
  <rect
    x={subgraph.bounds.x}
    y={subgraph.bounds.y}
    width={subgraph.bounds.width}
    height={subgraph.bounds.height}
    rx="12"
    ry="12"
    fill={resolved().fill}
    stroke={resolved().stroke}
    stroke-width={strokeWidth}
    stroke-dasharray={strokeDasharray || undefined}
  />
  <!-- Label area: d3-drag attached via data-sg-drag -->
  <rect
    data-sg-drag={subgraph.id}
    x={subgraph.bounds.x}
    y={subgraph.bounds.y}
    width={subgraph.bounds.width}
    height={28}
    fill="transparent"
    pointer-events={interactive ? 'fill' : 'none'}
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
