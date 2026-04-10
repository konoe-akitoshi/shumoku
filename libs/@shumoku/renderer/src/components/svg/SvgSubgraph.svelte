<script lang="ts">
  import type { ResolvedSubgraph, Theme } from '@shumoku/core'
  import type { SurfaceToken } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'

  let {
    subgraph,
    colors,
    theme,
  }: {
    subgraph: ResolvedSubgraph
    colors: RenderColors
    theme?: Theme
  } = $props()

  const style = $derived(subgraph.subgraph.style ?? {})

  // Surface token resolution: same as svg.ts resolveSurfaceColors
  const surfaceTokens: readonly string[] = [
    'surface-1', 'surface-2', 'surface-3',
    'accent-blue', 'accent-green', 'accent-red', 'accent-amber', 'accent-purple',
  ]

  function isSurfaceToken(v: string): v is SurfaceToken {
    return surfaceTokens.includes(v)
  }

  const resolved = $derived(() => {
    const fillValue = style.fill
    const strokeValue = style.stroke
    if (fillValue && isSurfaceToken(fillValue) && theme) {
      const sc = theme.colors.surfaces[fillValue]
      return {
        fill: sc.fill,
        stroke: strokeValue ?? sc.stroke,
        text: sc.text,
      }
    }
    return {
      fill: fillValue ?? colors.subgraphFill,
      stroke: strokeValue ?? colors.subgraphStroke,
      text: colors.subgraphText,
    }
  })

  const strokeWidth = $derived(style.strokeWidth ?? 3)
  const strokeDasharray = $derived(style.strokeDasharray ?? '')
  const rx = 12
</script>

<g class="subgraph" data-id={subgraph.id}>
  <rect
    x={subgraph.bounds.x}
    y={subgraph.bounds.y}
    width={subgraph.bounds.width}
    height={subgraph.bounds.height}
    {rx}
    ry={rx}
    fill={resolved().fill}
    stroke={resolved().stroke}
    stroke-width={strokeWidth}
    stroke-dasharray={strokeDasharray || undefined}
  />
  <text
    x={subgraph.bounds.x + 10}
    y={subgraph.bounds.y + 20}
    class="subgraph-label"
    text-anchor="start"
    fill={resolved().text}
  >
    {subgraph.subgraph.label}
  </text>
</g>
