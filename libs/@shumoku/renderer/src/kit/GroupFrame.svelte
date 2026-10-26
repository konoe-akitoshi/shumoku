<script lang="ts">
  import type { Subgraph, SurfaceToken, Theme } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { roundedPolygonPath } from './geometry'
  import type { Box, Point } from './scene'
  import type { Tokens } from './tokens'

  let {
    group,
    box,
    outline,
    colors,
    theme,
    tokens,
  }: {
    group: Subgraph
    box: Box
    /** The polygon the frame is drawn as; the box when absent. */
    outline?: Point[]
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

  /** The corners of the frame, clockwise from the top-left corner of its first band. */
  const corners = $derived(
    outline && outline.length > 0
      ? outline
      : [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
          { x: box.x, y: box.y + box.height },
        ],
  )
  const origin = $derived(corners[0] ?? { x: box.x, y: box.y })
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
  <path
    class="subgraph-bg"
    d={roundedPolygonPath(corners, tokens.group.cornerRadius)}
    fill={resolved.fill}
    stroke={resolved.stroke}
    stroke-width={style.strokeWidth ?? tokens.line.heavy}
    stroke-dasharray={style.strokeDasharray || undefined}
  />
  <text
    x={origin.x + tokens.group.labelX}
    y={origin.y + tokens.group.labelBand / 2 + tokens.text.groupLabel.shift}
    class="subgraph-label"
    text-anchor="start"
    fill={resolved.text}
    pointer-events="none"
  >
    {group.label}
  </text>
</g>
