<script lang="ts">
  import type { ResolvedSubgraph } from '@shumoku/core'

  let { subgraph }: { subgraph: ResolvedSubgraph } = $props()
</script>

<g class="subgraph" data-subgraph-id={subgraph.id}>
  <rect
    x={subgraph.bounds.x}
    y={subgraph.bounds.y}
    width={subgraph.bounds.width}
    height={subgraph.bounds.height}
    rx="12"
    fill="#f1f5f9"
    fill-opacity="0.5"
    stroke="#cbd5e1"
    stroke-width="1"
    stroke-dasharray="4 2"
  />
  <text
    x={subgraph.bounds.x + 12}
    y={subgraph.bounds.y + 20}
    font-size="11"
    font-weight="600"
    fill="#475569"
    text-transform="uppercase"
  >
    {subgraph.subgraph.label}
  </text>
</g>
