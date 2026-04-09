<script lang="ts">
  import type { ResolvedEdge } from '@shumoku/core'
  import { pointsToPathD } from '../../lib/svg-coords'

  let {
    edge,
    selected = false,
  }: {
    edge: ResolvedEdge
    selected?: boolean
  } = $props()

  const pathD = $derived(pointsToPathD(edge.points))
</script>

<g class="edge" data-edge-id={edge.id}>
  <!-- Wide transparent hit area -->
  <path
    d={pathD}
    fill="none"
    stroke="transparent"
    stroke-width={Math.max(edge.width + 12, 16)}
    stroke-linecap="round"
    style="pointer-events: stroke; cursor: pointer;"
    data-edge-click={edge.id}
  />
  <!-- Visible line -->
  <path
    d={pathD}
    fill="none"
    stroke={selected ? '#3b82f6' : '#64748b'}
    stroke-width={edge.width}
    stroke-linecap="round"
    pointer-events="none"
  />
</g>
