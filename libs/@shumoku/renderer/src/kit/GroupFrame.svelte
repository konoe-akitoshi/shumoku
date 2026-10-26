<script lang="ts">
  import type { Subgraph, SurfaceToken, Theme } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import type { Box } from './scene'
  import type { Tokens } from './tokens'

  let {
    group,
    box,
    colors,
    theme,
    tokens,
  }: {
    group: Subgraph
    box: Box
    colors: RenderColors
    theme?: Theme
    tokens: Tokens
  } = $props()

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

  const style = $derived(group.style ?? {})
  const resolved = $derived.by(() => {
    if (style.fill && surfaceTokens.includes(style.fill) && theme) {
      const token = theme.colors.surfaces[style.fill as SurfaceToken]
      return { fill: token.fill, stroke: style.stroke ?? token.stroke, text: token.text }
    }
    return {
      fill: style.fill ?? colors.subgraphFill,
      stroke: style.stroke ?? colors.subgraphStroke,
      text: colors.subgraphText,
    }
  })
</script>

<g class="subgraph" data-id={group.id}>
  <rect
    class="subgraph-bg"
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    rx={tokens.group.cornerRadius}
    ry={tokens.group.cornerRadius}
    fill={resolved.fill}
    stroke={resolved.stroke}
    stroke-width={style.strokeWidth ?? tokens.line.heavy}
    stroke-dasharray={style.strokeDasharray || undefined}
  />
  <text
    x={box.x + tokens.group.labelX}
    y={box.y + tokens.group.labelBand / 2 + tokens.text.groupLabel.shift}
    class="subgraph-label"
    text-anchor="start"
    fill={resolved.text}
    pointer-events="none"
  >
    {group.label}
  </text>
</g>
