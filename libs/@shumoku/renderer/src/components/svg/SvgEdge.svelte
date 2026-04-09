<script lang="ts">
  import type { ResolvedEdge } from '@shumoku/core'

  let {
    edge,
    selected = false,
  }: {
    edge: ResolvedEdge
    selected?: boolean
  } = $props()

  const pathD = $derived(() => {
    if (edge.points.length === 0) return ''
    const [first, ...rest] = edge.points
    if (!first) return ''
    let d = `M ${first.x} ${first.y}`
    for (const pt of rest) {
      d += ` L ${pt.x} ${pt.y}`
    }
    return d
  })
</script>

<g class="edge" data-edge-id={edge.id}>
  <!-- Invisible wide hit area for click/hover -->
  <path
    d={pathD()}
    fill="none"
    stroke="transparent"
    stroke-width={Math.max(edge.width + 12, 16)}
    stroke-linecap="round"
    style="pointer-events: stroke; cursor: pointer;"
    data-edge-click={edge.id}
  />
  <!-- Visible line -->
  <path
    d={pathD()}
    fill="none"
    stroke={selected ? '#3b82f6' : '#64748b'}
    stroke-width={edge.width}
    stroke-linecap="round"
    pointer-events="none"
  />
</g>
