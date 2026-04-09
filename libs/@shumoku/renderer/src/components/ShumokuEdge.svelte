<script lang="ts">
  import type { ResolvedEdge } from '@shumoku/core'

  let { edge }: { edge: ResolvedEdge } = $props()

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
  <path d={pathD()} fill="none" stroke="#64748b" stroke-width={edge.width} stroke-linecap="round" />
</g>
